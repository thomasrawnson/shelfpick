from copy import deepcopy

import pytest

from prototypes.scoresheets.demo import SHEETS, TEMPLATES
from prototypes.scoresheets.engine import ScoreSheetError, calculate, validate_template


def test_generic_tie_and_negative_score():
    result = calculate(TEMPLATES["generic"], SHEETS["generic"])
    assert result["winner_ids"] == ["ada", "ben"]
    sheet = deepcopy(SHEETS["generic"])
    sheet["entrants"][0]["cells"]["score"] = -2
    assert calculate(TEMPLATES["generic"], sheet)["winner_ids"] == ["ben"]


def test_rounds_recalculate_after_edit():
    sheet = deepcopy(SHEETS["rounds"])
    result = calculate(TEMPLATES["rounds"], sheet)
    assert result["entrants"][0]["running_totals"] == ["4", "2", "10"]
    assert result["winner_ids"] == ["ada"]
    sheet["entrants"][0]["rounds"][0] = -4
    edited = calculate(TEMPLATES["rounds"], sheet)
    assert edited["entrants"][0]["running_totals"] == ["-4", "-6", "2"]
    assert edited["winner_ids"] == ["ben"]


def test_rounds_require_same_count_and_missing_round_blocks_result():
    sheet = deepcopy(SHEETS["rounds"])
    sheet["entrants"][0]["rounds"].pop()
    with pytest.raises(ScoreSheetError, match="same number"):
        calculate(TEMPLATES["rounds"], sheet)
    sheet["entrants"][0]["rounds"].append(None)
    result = calculate(TEMPLATES["rounds"], sheet)
    assert result["complete"] is False
    assert result["winner_ids"] == []


def test_category_subtotals_condition_multiplier_and_expansion():
    result = calculate(TEMPLATES["categories"], SHEETS["categories"])
    assert result["entrants"][0]["subtotals"] == {"garden": "7", "bonus": "6"}
    assert result["entrants"][0]["total"] == "13"
    assert result["entrants"][1]["total"] == "11"
    assert result["winner_ids"] == ["team_a"]


def test_missing_required_score_suppresses_winner_and_total():
    sheet = deepcopy(SHEETS["categories"])
    del sheet["entrants"][0]["cells"]["pond_bonus"]
    result = calculate(TEMPLATES["categories"], sheet)
    assert result["complete"] is False
    assert result["entrants"][0]["partial_total"] == "8"
    assert result["entrants"][0]["total"] is None
    assert result["winner_ids"] == []


def test_optional_score_can_be_missing():
    sheet = deepcopy(SHEETS["categories"])
    del sheet["entrants"][0]["cells"]["moon_tokens"]
    assert calculate(TEMPLATES["categories"], sheet)["complete"] is True


def test_expansion_field_is_inactive_without_expansion():
    sheet = deepcopy(SHEETS["categories"])
    sheet["expansions"] = []
    with pytest.raises(ScoreSheetError, match="inactive"):
        calculate(TEMPLATES["categories"], sheet)
    del sheet["entrants"][0]["cells"]["moon_tokens"]
    assert calculate(TEMPLATES["categories"], sheet)["entrants"][0]["total"] == "12"


def test_low_score_wins_and_scores_only():
    template = deepcopy(TEMPLATES["generic"])
    template["winner"] = "low"
    sheet = deepcopy(SHEETS["generic"])
    sheet["entrants"][0]["cells"]["score"] = -1
    assert calculate(template, sheet)["winner_ids"] == ["ada"]
    template["winner"] = "none"
    assert calculate(template, sheet)["winner_ids"] == []


def test_blank_generic_score_is_incomplete_not_zero():
    sheet = deepcopy(SHEETS["generic"])
    sheet["entrants"][0]["cells"] = {}
    result = calculate(TEMPLATES["generic"], sheet)
    assert result["entrants"][0]["total"] is None
    assert result["winner_ids"] == []


@pytest.mark.parametrize("bad", ["NaN", "Infinity", "1e100", True, "hello"])
def test_invalid_numeric_input(bad):
    sheet = deepcopy(SHEETS["generic"])
    sheet["entrants"][0]["cells"]["score"] = bad
    with pytest.raises(ScoreSheetError):
        calculate(TEMPLATES["generic"], sheet)


@pytest.mark.parametrize("change", [
    lambda t: t["fields"].append(deepcopy(t["fields"][0])),
    lambda t: t["fields"][0].update(multiplier="NaN"),
    lambda t: t["fields"][0].update(when={"field": "missing", "equals": True}),
    lambda t: t.update(schema_version=2),
    lambda t: t.update(bgg_id=-1),
    lambda t: t.update(variants=[[]]),
])
def test_invalid_template(change):
    template = deepcopy(TEMPLATES["generic"])
    change(template)
    with pytest.raises(ScoreSheetError):
        validate_template(template)


def test_exact_template_version_required():
    sheet = deepcopy(SHEETS["generic"])
    sheet["version"] = "v2"
    with pytest.raises(ScoreSheetError, match="version mismatch"):
        calculate(TEMPLATES["generic"], sheet)


def test_deterministic_without_mutation():
    sheet = deepcopy(SHEETS["rounds"])
    before = deepcopy(sheet)
    assert calculate(TEMPLATES["rounds"], sheet) == calculate(TEMPLATES["rounds"], sheet)
    assert sheet == before


def test_inactive_field_and_unknown_field_rejected():
    sheet = deepcopy(SHEETS["categories"])
    sheet["entrants"][1]["cells"]["pond_bonus"] = 1
    with pytest.raises(ScoreSheetError, match="inactive"):
        calculate(TEMPLATES["categories"], sheet)
    sheet = deepcopy(SHEETS["categories"])
    sheet["entrants"][1]["cells"]["unknown"] = 1
    with pytest.raises(ScoreSheetError, match="invalid cells"):
        calculate(TEMPLATES["categories"], sheet)
