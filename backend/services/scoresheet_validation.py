"""Validation of scoresheet templates against ``scoresheets/schema.v1.json``.

The JSON Schema checker supports the same keyword subset as
``scoresheets/lib/json-schema.mjs`` and fails loudly on any other keyword, so
the schema file stays the single definition of the format. The semantic checks
mirror ``templateProblems`` in ``scoresheets/validate.mjs``.
"""

import json
import re
from functools import lru_cache
from pathlib import Path

SCORESHEETS_DIR = Path(__file__).resolve().parents[2] / "scoresheets"
TEMPLATES_DIR = SCORESHEETS_DIR / "templates"
FORMAT_VERSION = 1

_IGNORED = {"$schema", "$id", "title", "$defs"}
_KNOWN = {
    "type", "enum", "const", "required", "properties",
    "additionalProperties", "items", "minItems", "maxItems", "minLength",
    "minimum", "pattern", "$ref",
}

# Extra bounds for sheets people build in the app. Built-in templates are
# reviewed files and are not held to these.
CUSTOM_LIMITS = {
    "name": 100,
    "label": 60,
    "help": 200,
    "notes": 500,
    "categories": 40,
    "rounds": 50,
    "tie_breakers": 10,
    "result_bands": 10,
    "points_per": 1000,
    "players": 20,
}


@lru_cache(maxsize=1)
def load_schema() -> dict:
    return json.loads((SCORESHEETS_DIR / "schema.v1.json").read_text("utf-8"))


def _type_of(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    if isinstance(value, int) or (
        isinstance(value, float) and value.is_integer()
    ):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    return type(value).__name__


def _matches_type(value, expected: str) -> bool:
    actual = _type_of(value)
    return expected == actual or (expected == "number" and actual == "integer")


def validate_schema(root: dict, value) -> list[str]:
    errors: list[str] = []

    def walk(schema: dict, data, path: str) -> None:
        for key in schema:
            if key not in _KNOWN and key not in _IGNORED:
                raise ValueError(f"Unsupported schema keyword: {key}")
        where = path or "/"
        if "$ref" in schema:
            name = schema["$ref"].replace("#/$defs/", "")
            walk(root["$defs"][name], data, path)
            return
        if "type" in schema:
            types = schema["type"]
            types = types if isinstance(types, list) else [types]
            if not any(_matches_type(data, t) for t in types):
                errors.append(
                    f"{where}: expected {'|'.join(types)}, got {_type_of(data)}"
                )
                return
        if "const" in schema and (
            data != schema["const"] or isinstance(data, bool)
        ):
            errors.append(f"{where}: must equal {json.dumps(schema['const'])}")
        if "enum" in schema and data not in schema["enum"]:
            errors.append(
                f"{where}: must be one of {', '.join(map(str, schema['enum']))}"
            )
        if isinstance(data, str):
            if "minLength" in schema and len(data) < schema["minLength"]:
                errors.append(f"{where}: too short")
            if "pattern" in schema and not re.search(schema["pattern"], data):
                errors.append(f"{where}: does not match {schema['pattern']}")
        if (
            _type_of(data) in ("integer", "number")
            and "minimum" in schema
            and data < schema["minimum"]
        ):
            errors.append(f"{where}: below minimum {schema['minimum']}")
        if isinstance(data, list):
            if "minItems" in schema and len(data) < schema["minItems"]:
                errors.append(
                    f"{where}: needs at least {schema['minItems']} items"
                )
            if "maxItems" in schema and len(data) > schema["maxItems"]:
                errors.append(
                    f"{where}: allows at most {schema['maxItems']} items"
                )
            if "items" in schema:
                for index, item in enumerate(data):
                    walk(schema["items"], item, f"{path}/{index}")
        if isinstance(data, dict):
            for key in schema.get("required", []):
                if key not in data:
                    errors.append(f"{where}: missing required property {key}")
            props = schema.get("properties", {})
            extra = schema.get("additionalProperties")
            for key, child in data.items():
                if key in props:
                    walk(props[key], child, f"{path}/{key}")
                elif extra is False:
                    errors.append(f"{path}/{key}: unexpected property")
                elif isinstance(extra, dict):
                    walk(extra, child, f"{path}/{key}")

    walk(root, value, "")
    return errors


def template_problems(sheet) -> list[str]:
    """Schema and semantic problems for one template; empty when valid."""
    problems = validate_schema(load_schema(), sheet)
    if problems:
        return problems
    ids = [category["id"] for category in sheet["categories"]]
    if len(set(ids)) != len(ids):
        problems.append("duplicate category id")
    low, high = sheet["supported_players"]
    if low > high:
        problems.append("supported_players min is above max")
    condition = sheet["win_condition"]
    if condition == "target" and "target_score" not in sheet:
        problems.append("target win_condition needs target_score")
    if condition == "cooperative" and "target_score" in sheet:
        problems.append("cooperative games take no target_score")
    if condition == "cooperative" and sheet["tie_breakers"]:
        problems.append("cooperative games take no tie_breakers")
    breakers = sheet["tie_breakers"]
    for index, cid in enumerate(breakers):
        if cid == "shared":
            if index != len(breakers) - 1:
                problems.append('"shared" must be last in tie_breakers')
        elif cid not in ids:
            problems.append(f"tie_breaker {cid} is not a category id")
    for category in sheet["categories"]:
        if category["type"] == "boolean" and category["allow_negative"]:
            problems.append(f"{category['id']}: boolean cannot allow_negative")
        if category["type"] == "boolean" and category["scope"] == "per_round":
            problems.append(f"{category['id']}: boolean must be once-scope")
    bands = sheet.get("result_bands")
    if bands:
        mins = [band["min_total"] for band in bands]
        if len(set(mins)) != len(mins):
            problems.append("duplicate result_bands min_total")
    return problems


def custom_sheet_problems(sheet) -> list[str]:
    """Template problems plus the size limits for sheets built in the app."""
    problems = template_problems(sheet)
    if problems:
        return problems
    limits = CUSTOM_LIMITS
    if len(sheet["name"]) > limits["name"]:
        problems.append(f"name: at most {limits['name']} characters")
    if len(sheet["notes"]) > limits["notes"]:
        problems.append(f"notes: at most {limits['notes']} characters")
    if len(sheet["categories"]) > limits["categories"]:
        problems.append(f"at most {limits['categories']} categories")
    if sheet["rounds"] is not None and sheet["rounds"] > limits["rounds"]:
        problems.append(f"at most {limits['rounds']} rounds")
    if sheet["supported_players"][1] > limits["players"]:
        problems.append(f"at most {limits['players']} players")
    if len(sheet["tie_breakers"]) > limits["tie_breakers"]:
        problems.append(f"at most {limits['tie_breakers']} tie-breakers")
    if len(sheet.get("result_bands") or []) > limits["result_bands"]:
        problems.append(f"at most {limits['result_bands']} result bands")
    for category in sheet["categories"]:
        cid = category["id"]
        if len(category["label"]) > limits["label"]:
            problems.append(f"{cid}: label is too long")
        if len(category["help"]) > limits["help"]:
            problems.append(f"{cid}: help is too long")
        if abs(category["points_per"]) > limits["points_per"]:
            problems.append(f"{cid}: points per entry is too large")
    return problems
