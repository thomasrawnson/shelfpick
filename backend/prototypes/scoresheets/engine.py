"""Isolated SP-SCORE-01 experiment. No API or persistence imports."""

from decimal import Decimal, InvalidOperation
import re


class ScoreSheetError(ValueError):
    pass


_ID = re.compile(r"^[a-z][a-z0-9_]{0,63}$")
_MAX = Decimal("1000000000")


def _number(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float, str, Decimal)):
        raise ScoreSheetError(f"{label} must be a number")
    if len(str(value)) > 64:
        raise ScoreSheetError(f"{label} is out of range")
    try:
        result = Decimal(str(value))
    except InvalidOperation as exc:
        raise ScoreSheetError(f"{label} must be a number") from exc
    if not result.is_finite() or abs(result) > _MAX:
        raise ScoreSheetError(f"{label} is out of range")
    return result


def validate_template(template):
    if not isinstance(template, dict) or template.get("schema_version") != 1:
        raise ScoreSheetError("unsupported schema version")
    for key in ("template_id", "version"):
        if not isinstance(template.get(key), str) or not _ID.fullmatch(template[key]):
            raise ScoreSheetError(f"invalid {key}")
    bgg_id = template.get("bgg_id")
    if bgg_id is not None and (type(bgg_id) is not int or bgg_id <= 0):
        raise ScoreSheetError("invalid bgg_id")
    mode = template.get("mode")
    if mode not in ("generic", "rounds", "categories"):
        raise ScoreSheetError("invalid mode")
    if template.get("winner") not in ("high", "low", "none"):
        raise ScoreSheetError("invalid winner policy")
    fields = template.get("fields")
    if not isinstance(fields, list) or not fields or len(fields) > 64:
        raise ScoreSheetError("fields must contain 1–64 entries")
    ids = set()
    for field in fields:
        if not isinstance(field, dict) or not isinstance(field.get("id"), str) or not _ID.fullmatch(field["id"]):
            raise ScoreSheetError("invalid field id")
        if field["id"] in ids:
            raise ScoreSheetError("duplicate field id")
        ids.add(field["id"])
        if field.get("type") not in ("number", "boolean"):
            raise ScoreSheetError("invalid field type")
        if type(field.get("required")) is not bool:
            raise ScoreSheetError("required must be boolean")
        if field["type"] == "number":
            _number(field.get("multiplier", 1), "multiplier")
        elif "multiplier" in field or "group" in field:
            raise ScoreSheetError("boolean field cannot be scored")
        if "group" in field and (not isinstance(field["group"], str) or not _ID.fullmatch(field["group"])):
            raise ScoreSheetError("invalid group")
    by_id = {field["id"]: field for field in fields}
    if not any(field["type"] == "number" and field["required"] and "when" not in field for field in fields):
        raise ScoreSheetError("at least one unconditional score is required")
    for field in fields:
        condition = field.get("when")
        if condition is not None:
            if (not isinstance(condition, dict) or set(condition) != {"field", "equals"}
                    or type(condition["equals"]) is not bool
                    or not isinstance(condition["field"], str)
                    or condition["field"] not in by_id
                    or by_id[condition["field"]]["type"] != "boolean"
                    or not by_id[condition["field"]]["required"]
                    or condition["field"] == field["id"]):
                raise ScoreSheetError("invalid condition")
    if mode == "rounds":
        if len(fields) != 1 or fields[0]["type"] != "number":
            raise ScoreSheetError("rounds require one numeric field")
        max_rounds = template.get("max_rounds")
        if type(max_rounds) is not int or not 1 <= max_rounds <= 100:
            raise ScoreSheetError("invalid max_rounds")
    elif "max_rounds" in template:
        raise ScoreSheetError("max_rounds only applies to rounds")
    for key in ("variants", "expansions"):
        values = template.get(key, [])
        if (not isinstance(values, list) or any(not isinstance(value, str) or not _ID.fullmatch(value) for value in values)
                or len(values) != len(set(values))):
            raise ScoreSheetError(f"invalid {key}")
    for field in fields:
        for key, source in (("variants", "variants"), ("expansions", "expansions")):
            values = field.get(key, [])
            if (not isinstance(values, list) or any(not isinstance(value, str) or value not in template.get(source, []) for value in values)
                    or len(values) != len(set(values))):
                raise ScoreSheetError(f"invalid field {key}")
    return template


def calculate(template, sheet):
    """Pure calculation; incomplete entries have no total or winner."""
    validate_template(template)
    if not isinstance(sheet, dict) or sheet.get("template_id") != template["template_id"] or sheet.get("version") != template["version"]:
        raise ScoreSheetError("template identity/version mismatch")
    if sheet.get("variant") not in [None, *template.get("variants", [])]:
        raise ScoreSheetError("unknown variant")
    expansions = sheet.get("expansions", [])
    if (not isinstance(expansions, list) or any(not isinstance(value, str) or value not in template.get("expansions", []) for value in expansions)
            or len(expansions) != len(set(expansions))):
        raise ScoreSheetError("unknown expansion")
    entrants = sheet.get("entrants")
    if not isinstance(entrants, list) or not 1 <= len(entrants) <= 32:
        raise ScoreSheetError("entrants must contain 1–32 entries")
    entrant_ids = set()
    results = []
    round_count = None
    for entrant in entrants:
        if not isinstance(entrant, dict) or not isinstance(entrant.get("id"), str) or not _ID.fullmatch(entrant["id"]) or entrant["id"] in entrant_ids:
            raise ScoreSheetError("invalid or duplicate entrant id")
        entrant_ids.add(entrant["id"])
        if entrant.get("kind", "player") not in ("player", "team"):
            raise ScoreSheetError("invalid entrant kind")
        if template["mode"] == "rounds":
            rounds = entrant.get("rounds")
            if not isinstance(rounds, list) or not 1 <= len(rounds) <= template["max_rounds"]:
                raise ScoreSheetError("invalid rounds")
            if round_count is None:
                round_count = len(rounds)
            elif len(rounds) != round_count:
                raise ScoreSheetError("entrants must have the same number of rounds")
            running = []
            subtotal = Decimal(0)
            complete = True
            for value in rounds:
                if value is None:
                    complete = False
                else:
                    subtotal += _number(value, "round score")
                if abs(subtotal) > _MAX:
                    raise ScoreSheetError("total out of range")
                running.append(str(subtotal))
            details = {"running_totals": running}
        else:
            cells = entrant.get("cells")
            if not isinstance(cells, dict) or set(cells) - {f["id"] for f in template["fields"]}:
                raise ScoreSheetError("invalid cells")
            subtotal = Decimal(0)
            groups = {}
            complete = True
            details = {}
            for field in template["fields"]:
                condition = field.get("when")
                active = (not field.get("variants") or sheet.get("variant") in field["variants"])
                active = active and (not field.get("expansions") or bool(set(field["expansions"]) & set(expansions)))
                active = active and (condition is None or cells.get(condition["field"]) is condition["equals"])
                value = cells.get(field["id"])
                if not active:
                    if value is not None:
                        raise ScoreSheetError("inactive field has a value")
                    continue
                if value is None:
                    if field["required"]:
                        complete = False
                    continue
                if field["type"] == "boolean":
                    if type(value) is not bool:
                        raise ScoreSheetError("boolean field has invalid value")
                    continue
                points = _number(value, field["id"]) * _number(field.get("multiplier", 1), "multiplier")
                if abs(points) > _MAX:
                    raise ScoreSheetError("score out of range")
                subtotal += points
                group = field.get("group")
                if group:
                    groups[group] = groups.get(group, Decimal(0)) + points
                details[field["id"]] = str(points)
            details["subtotals"] = {key: str(value) for key, value in groups.items()}
        if abs(subtotal) > _MAX:
            raise ScoreSheetError("total out of range")
        results.append({"id": entrant["id"], "kind": entrant.get("kind", "player"),
                        "complete": complete, "partial_total": str(subtotal),
                        "total": str(subtotal) if complete else None, **details})
    winners = []
    if all(result["complete"] for result in results) and template["winner"] != "none":
        totals = {result["id"]: Decimal(result["total"]) for result in results}
        best = max(totals.values()) if template["winner"] == "high" else min(totals.values())
        winners = [key for key, value in totals.items() if value == best]
    return {"complete": all(result["complete"] for result in results),
            "entrants": results, "winner_ids": winners}
