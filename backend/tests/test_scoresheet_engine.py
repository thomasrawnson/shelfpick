"""Scoring engine: SCORE-00 fixtures and property checks."""

import json
import random
from itertools import product

import pytest

from services import scoresheet_engine as engine
from services.scoresheet_validation import (
    SCORESHEETS_DIR,
    custom_sheet_problems,
    template_problems,
)

TEMPLATES = {
    json.loads(path.read_text())["bgg_id"]: json.loads(path.read_text())
    for path in sorted((SCORESHEETS_DIR / "templates").glob("*.json"))
}
FIXTURES = sorted((SCORESHEETS_DIR / "fixtures").glob("*.json"))


def test_every_template_has_a_fixture():
    assert len(TEMPLATES) >= 25
    assert {int(path.stem) for path in FIXTURES} == set(TEMPLATES)


@pytest.mark.parametrize("path", FIXTURES, ids=lambda p: p.stem)
def test_fixture_totals_and_winner(path):
    fixture = json.loads(path.read_text())
    sheet = TEMPLATES[fixture["bgg_id"]]
    assert template_problems(sheet) == []
    players = fixture["players"]
    for player in players:
        assert engine.check_inputs(sheet, player["scores"]) == []

    result = engine.score_play(sheet, [p["scores"] for p in players])

    names = [p["name"] for p in players]
    assert dict(zip(names, result["totals"])) == fixture["expected"]["totals"]
    assert sorted(names[i] for i in result["winners"]) == sorted(
        fixture["expected"]["winner"]
    )
    if "result_band" in fixture["expected"]:
        assert result["result_band"] == fixture["expected"]["result_band"]


def sheet(**overrides):
    base = {
        "format_version": 1,
        "bgg_id": 1,
        "name": "Test",
        "supported_players": [1, 6],
        "win_condition": "highest",
        "rounds": None,
        "categories": [
            {"id": "points", "label": "Points", "help": "Points.",
             "type": "number", "points_per": 1, "allow_negative": True,
             "scope": "once"},
            {"id": "coins", "label": "Coins", "help": "Coins.",
             "type": "count", "points_per": 0, "allow_negative": False,
             "scope": "once"},
        ],
        "tie_breakers": [],
        "source": {"rulebook_title": "x", "edition_or_year": "x",
                   "checked_against_rulebook": False},
        "notes": "",
    }
    return {**base, **overrides}


def brute_force_ranks(template, players):
    """Reference: rank = 1 + number of players who beat you outright."""
    totals = [engine.player_total(template, p) for p in players]
    lowest = template["win_condition"] == "lowest"
    breakers = []
    for cid in template["tie_breakers"]:
        if cid == "shared":
            break
        breakers.append(cid)
    by_id = {c["id"]: c for c in template["categories"]}

    def beats(a, b):
        if totals[a] != totals[b]:
            return totals[a] < totals[b] if lowest else totals[a] > totals[b]
        for cid in breakers:
            c = by_id[cid]
            x = engine.raw_total(c, players[a].get(cid))
            y = engine.raw_total(c, players[b].get(cid))
            if x != y:
                lower = c.get("tie_break_direction") == "lower"
                return x < y if lower else x > y
        return False

    return [
        1 + sum(beats(b, a) for b in range(len(players)))
        for a in range(len(players))
    ]


@pytest.mark.parametrize("condition", ["highest", "lowest"])
@pytest.mark.parametrize("breakers", [[], ["coins"], ["coins", "shared"]])
def test_ranks_match_brute_force_with_ties_and_negatives(condition, breakers):
    rng = random.Random(f"{condition}{breakers}")
    template = sheet(win_condition=condition, tie_breakers=breakers)
    for _ in range(300):
        count = rng.randint(2, 6)
        players = [
            {"points": rng.randint(-3, 3), "coins": rng.randint(0, 2)}
            for _ in range(count)
        ]
        result = engine.score_play(template, players)
        assert result["ranks"] == brute_force_ranks(template, players)
        assert result["winners"] == [
            i for i, r in enumerate(result["ranks"]) if r == 1
        ]
        best = (min if condition == "lowest" else max)(result["totals"])
        assert all(result["totals"][i] == best for i in result["winners"])


def test_tie_breaker_direction_lower():
    template = sheet(
        categories=[
            sheet()["categories"][0],
            {**sheet()["categories"][1], "tie_break_direction": "lower"},
        ],
        tie_breakers=["coins"],
    )
    result = engine.score_play(
        template, [{"points": 5, "coins": 2}, {"points": 5, "coins": 1}]
    )
    assert result["ranks"] == [2, 1]


def test_shared_tie_is_a_draw():
    result = engine.score_play(
        sheet(tie_breakers=["shared"]),
        [{"points": 4}, {"points": 4}, {"points": 1}],
    )
    assert result["ranks"] == [1, 1, 3]
    assert result["winners"] == [0, 1]


def test_negatives_and_penalties():
    template = sheet(categories=[
        sheet()["categories"][0],
        {"id": "curses", "label": "Curses", "help": "Curses.",
         "type": "count", "points_per": -1, "allow_negative": False,
         "scope": "once"},
    ])
    assert engine.player_total(template, {"points": -4, "curses": 3}) == -7
    assert engine.check_inputs(template, {"curses": -1}) == [
        "curses: count must be a whole number, 0 or more"
    ]


def test_per_round_categories_and_multipliers():
    template = sheet(rounds=3, categories=[
        {"id": "round", "label": "Round", "help": "Round.", "type": "number",
         "points_per": 2, "allow_negative": False, "scope": "per_round"},
        {"id": "bonus", "label": "Bonus", "help": "Bonus.", "type": "boolean",
         "points_per": 5, "allow_negative": False, "scope": "once"},
    ])
    assert engine.player_total(
        template, {"round": [1, 2, 3], "bonus": True}
    ) == 17
    assert engine.check_inputs(template, {"round": [1, 2]}) == [
        "round: needs 3 rounds"
    ]
    assert engine.check_inputs(template, {"round": 4}) == [
        "round: per_round needs a list"
    ]
    assert engine.check_inputs(template, {"bonus": 1}) == [
        "bonus: must be true or false"
    ]


def test_inputs_reject_unknown_and_non_numbers():
    template = sheet()
    assert engine.check_inputs(template, {"nope": 1}) == [
        "unknown category nope"
    ]
    assert engine.check_inputs(template, {"points": "12"}) == [
        "points: must be a number"
    ]
    assert engine.check_inputs(template, {"points": True}) == [
        "points: must be a number"
    ]
    assert engine.check_inputs(template, {"points": 10**9}) == [
        "points: number is too large"
    ]
    assert engine.check_inputs(template, {"points": None}) == []


def test_target_ranks_reached_players_first():
    template = sheet(win_condition="target", target_score=10)
    result = engine.score_play(
        template, [{"points": 9}, {"points": 10}, {"points": 12}]
    )
    assert result["winners"] == [2]
    assert result["ranks"] == [3, 2, 1]
    nobody = engine.score_play(template, [{"points": 9}, {"points": 2}])
    assert nobody["winners"] == [] and nobody["ranks"] is None


def test_cooperative_band_and_no_winners():
    template = sheet(
        win_condition="cooperative",
        result_bands=[{"min_total": 0, "label": "Low"},
                      {"min_total": 10, "label": "High"}],
    )
    for value, band in product([0, 9, 10, 25], [None]):
        result = engine.score_play(template, [{"points": value}] * 3)
        assert result["winners"] == [] and result["ranks"] is None
        assert result["result_band"] == ("High" if value >= 10 else "Low")


def test_solo_has_no_finishing_order():
    result = engine.score_play(sheet(), [{"points": 3}])
    assert result == {
        "totals": [3], "ranks": None, "winners": [], "result_band": None,
    }


def test_custom_limits():
    assert custom_sheet_problems(sheet()) == []
    long_label = sheet(categories=[
        {**sheet()["categories"][0], "label": "x" * 61},
    ])
    assert custom_sheet_problems(long_label) == ["points: label is too long"]
    assert "unexpected property" in " ".join(
        custom_sheet_problems({**sheet(), "extra": 1})
    )
    assert custom_sheet_problems(sheet(tie_breakers=["shared", "coins"])) == [
        '"shared" must be last in tie_breakers'
    ]
