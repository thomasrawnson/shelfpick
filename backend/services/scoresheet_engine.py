"""Scoresheet scoring engine: the server's single source of truth.

Mirrors ``scoresheets/score.mjs``; the rules are in ``scoresheets/SCHEMA.md``.
Pure functions over plain dicts: a ``sheet`` is a format-1 template and a
``scores`` dict maps category ids to entries (a number or tick for ``once``
categories, a list of numbers for ``per_round`` ones). A missing or ``None``
entry counts as 0.
"""

import math

MAX_ABS_VALUE = 1_000_000
MAX_OPEN_ROUNDS = 50


def _is_number(value) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
    )


def _categories_by_id(sheet: dict) -> dict[str, dict]:
    return {category["id"]: category for category in sheet["categories"]}


def raw_total(category: dict, value):
    """Sum of the raw inputs for one category (ticks are 1 or 0)."""
    if value is None:
        value = [] if category["scope"] == "per_round" else 0
    if category["type"] == "boolean":
        return 1 if value else 0
    if isinstance(value, list):
        return sum(value)
    return value


def category_points(category: dict, value):
    return raw_total(category, value) * category["points_per"]


def player_total(sheet: dict, scores: dict):
    total = 0
    for category in sheet["categories"]:
        total += category_points(category, scores.get(category["id"]))
    return total


def check_inputs(sheet: dict, scores) -> list[str]:
    """Input problems for one player's entries; empty when valid."""
    if not isinstance(scores, dict):
        return ["scores must be an object"]
    problems = []
    by_id = _categories_by_id(sheet)
    for key in scores:
        if key not in by_id:
            problems.append(f"unknown category {key}")
    for category in sheet["categories"]:
        cid = category["id"]
        value = scores.get(cid)
        if value is None:
            continue
        if category["scope"] == "per_round":
            if not isinstance(value, list):
                problems.append(f"{cid}: per_round needs a list")
                continue
            rounds = sheet["rounds"]
            if rounds is not None and len(value) != rounds:
                problems.append(f"{cid}: needs {rounds} rounds")
            if rounds is None and len(value) > MAX_OPEN_ROUNDS:
                problems.append(f"{cid}: at most {MAX_OPEN_ROUNDS} rounds")
            items = value
        elif isinstance(value, list):
            problems.append(f"{cid}: once-scope needs a single value")
            continue
        else:
            items = [value]
        for item in items:
            if category["type"] == "boolean":
                if not isinstance(item, bool):
                    problems.append(f"{cid}: must be true or false")
            elif not _is_number(item):
                problems.append(f"{cid}: must be a number")
            elif abs(item) > MAX_ABS_VALUE:
                problems.append(f"{cid}: number is too large")
            elif category["type"] == "count" and (
                item < 0 or not float(item).is_integer()
            ):
                problems.append(
                    f"{cid}: count must be a whole number, 0 or more"
                )
            elif (
                category["type"] == "number"
                and item < 0
                and not category["allow_negative"]
            ):
                problems.append(f"{cid}: negative values are not allowed")
    return problems


def result_band(sheet: dict, total) -> str | None:
    bands = sheet.get("result_bands")
    if not bands:
        return None
    for band in sorted(bands, key=lambda b: b["min_total"], reverse=True):
        if total >= band["min_total"]:
            return band["label"]
    return None


def _ordering_key(sheet: dict, scores: dict, total) -> tuple:
    """Smaller keys finish higher: total first, then each tie-breaker."""
    lowest_wins = sheet["win_condition"] == "lowest"
    key = [total if lowest_wins else -total]
    by_id = _categories_by_id(sheet)
    for cid in sheet["tie_breakers"]:
        if cid == "shared":
            break
        category = by_id[cid]
        raw = raw_total(category, scores.get(cid))
        lower = category.get("tie_break_direction", "higher") == "lower"
        key.append(raw if lower else -raw)
    return tuple(key)


def score_play(sheet: dict, players: list[dict]) -> dict:
    """Totals, finishing ranks, winners and band for one play.

    ``players`` is a list of score dicts in seat order. Returns
    ``totals`` (one per player), ``ranks`` (1 is first, equal ranks tie;
    ``None`` when there is no finishing order), ``winners`` (player indices)
    and ``result_band`` (cooperative sheets with bands only).

    Cooperative sheets and single-player plays have no finishing order. A
    ``target`` sheet ranks players who reached the target above those who did
    not, and has no order at all until someone reaches it.
    """
    totals = [player_total(sheet, scores) for scores in players]
    condition = sheet["win_condition"]

    if condition == "cooperative":
        band = result_band(sheet, totals[0]) if totals else None
        return {
            "totals": totals,
            "ranks": None,
            "winners": [],
            "result_band": band,
        }

    reached = [
        condition != "target" or total >= sheet["target_score"]
        for total in totals
    ]
    if len(players) < 2 or not any(reached):
        return {
            "totals": totals,
            "ranks": None,
            "winners": [],
            "result_band": None,
        }

    keys = [
        (0 if reached[i] else 1, *_ordering_key(sheet, scores, totals[i]))
        for i, scores in enumerate(players)
    ]
    ranks = [1 + sum(1 for other in keys if other < key) for key in keys]
    return {
        "totals": totals,
        "ranks": ranks,
        "winners": [i for i, rank in enumerate(ranks) if rank == 1],
        "result_band": None,
    }


def target_reached(sheet: dict, total) -> bool | None:
    """Whether a solo total reached the sheet's target; None without one."""
    if sheet["win_condition"] != "target":
        return None
    return total >= sheet["target_score"]
