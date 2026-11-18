"""Pure rules for SP-STATS-01: H-index, streaks and the Picker boost."""

from datetime import date

from models.game import Game
from services.picker_service import PickerCriteria, PickerService
from services.stats_service import (
    compute_h_index,
    compute_streaks,
    h_index_boosts,
)


def games(*plays):
    return [
        {"bgg_id": i + 1, "name": f"Game {chr(65 + i)}", "plays": count}
        for i, count in enumerate(plays)
    ]


def test_h_index_of_an_empty_history_is_zero():
    result = compute_h_index([])
    assert result["h_index"] == 0
    assert result["next_target"] == 1
    assert result["raise_list"] == []
    assert result["reachable"] is False


def test_h_index_with_unplayed_owned_games_asks_for_one_play():
    unplayed = [{"bgg_id": 9, "name": "Zed", "plays": 0}, {"bgg_id": 8, "name": "Abe", "plays": 0}]
    result = compute_h_index([], unplayed)
    assert result["h_index"] == 0
    assert [g["name"] for g in result["raise_list"]] == ["Abe"]
    assert result["raise_list"][0]["plays_needed"] == 1


def test_h_index_classic_cases():
    assert compute_h_index(games(5, 4, 3, 2, 1))["h_index"] == 3
    assert compute_h_index(games(1))["h_index"] == 1
    assert compute_h_index(games(10))["h_index"] == 1
    assert compute_h_index(games(2, 2))["h_index"] == 2
    assert compute_h_index(games(1, 1, 1))["h_index"] == 1


def test_ties_are_ordered_by_name_and_do_not_change_h():
    result = compute_h_index(games(3, 3, 3, 3))
    assert result["h_index"] == 3
    assert [g["name"] for g in result["qualifying_games"]] == [
        "Game A", "Game B", "Game C",
    ]


def test_raise_list_names_the_cheapest_games():
    # Plays 3,3,3 -> h = 3. Need a 4th game with 4 plays; k = 0 games have 4+.
    # Needs 4 games at 4 plays: the three 3-play games (1 each) and one more.
    unplayed = [{"bgg_id": 99, "name": "New", "plays": 0}]
    result = compute_h_index(games(3, 3, 3, 2), unplayed)
    assert result["h_index"] == 3
    assert result["games_needed"] == 4
    assert [g["plays_needed"] for g in result["raise_list"]] == [1, 1, 1, 2]
    assert result["plays_needed_total"] == 5
    assert result["reachable"] is True


def test_raise_list_is_unreachable_when_too_few_games():
    result = compute_h_index(games(5, 5, 5))
    assert result["h_index"] == 3
    # Every game already has the 4 plays the next level needs, so nothing in
    # the library can raise it: three games cannot make an H-index of 4.
    assert result["games_needed"] == 1
    assert result["raise_list"] == []
    assert result["reachable"] is False


def test_games_already_at_target_reduce_the_need():
    # h = 2 (5 and 4 plays); target 3, one game has >= 3, so two more needed.
    result = compute_h_index(games(5, 2, 2, 1))
    assert result["h_index"] == 2
    assert result["games_needed"] == 2
    assert [g["name"] for g in result["raise_list"]] == ["Game B", "Game C"]


def test_streak_across_a_year_boundary():
    # Mondays: 2026-12-21, 12-28, 2027-01-04 are consecutive weeks.
    weeks = [date(2026, 12, 21), date(2026, 12, 28), date(2027, 1, 4)]
    streak = compute_streaks(weeks, date(2027, 1, 4))
    assert streak["current_weeks"] == 3
    assert streak["best_weeks"] == 3
    assert streak["at_risk"] is False


def test_streak_survives_an_empty_current_week_but_is_at_risk():
    weeks = [date(2026, 11, 2), date(2026, 11, 9)]
    streak = compute_streaks(weeks, date(2026, 11, 16))
    assert streak["current_weeks"] == 2
    assert streak["at_risk"] is True
    assert streak["played_this_week"] is False


def test_streak_breaks_after_a_missed_week_and_keeps_the_best():
    weeks = [date(2026, 10, 5), date(2026, 10, 12), date(2026, 10, 19), date(2026, 11, 9)]
    streak = compute_streaks(weeks, date(2026, 11, 23))
    assert streak["current_weeks"] == 0
    assert streak["best_weeks"] == 3


def test_streak_with_no_plays():
    streak = compute_streaks([], date(2026, 11, 16))
    assert streak == {
        "current_weeks": 0,
        "best_weeks": 0,
        "played_this_week": False,
        "at_risk": False,
        "this_week_start": date(2026, 11, 16),
    }


# ---- Picker boost ---------------------------------------------------- #


def owned(bgg_id, name):
    return Game(
        bgg_id=bgg_id, name=name, min_players=2, max_players=4,
        min_play_time=30, max_play_time=45, owned=True,
    )


def test_boost_changes_ranking_deterministically_and_is_explained():
    # Alphabetically "Alpha" wins a tie; the boost should lift "Zulu".
    library = [owned(1, "Alpha"), owned(2, "Zulu")]
    criteria = PickerCriteria(players=3)
    service = PickerService()

    plain = service.rank_matches(library, criteria)
    assert [m.game.name for m in plain] == ["Alpha", "Zulu"]
    assert plain[0].score == plain[1].score

    boosts = h_index_boosts(
        compute_h_index(
            [
                {"bgg_id": 1, "name": "Alpha", "plays": 1},
                {"bgg_id": 2, "name": "Zulu", "plays": 1},
                {"bgg_id": 3, "name": "Other", "plays": 4},
                {"bgg_id": 4, "name": "Other 2", "plays": 4},
            ]
        )
    )
    # h = 2; target 3; plays_needed: Alpha 2, Zulu 2 -> +3 each, no change.
    assert boosts[1]["points"] == boosts[2]["points"] == 3

    boosts[2]["points"] = 6  # one play away
    first = service.rank_matches(library, criteria, h_index_boosts=boosts)
    second = service.rank_matches(library, criteria, h_index_boosts=boosts)
    assert [m.game.name for m in first] == ["Zulu", "Alpha"]
    assert [m.game.name for m in first] == [m.game.name for m in second]
    zulu = [r for r in first[0].reasons if r.startswith("Helps your H-index")]
    alpha = [r for r in first[1].reasons if r.startswith("Helps your H-index")]
    assert zulu == [boosts[2]["reason"]]
    assert alpha == [boosts[1]["reason"]]
    assert "2 more plays" in alpha[0] and "H-index of 3" in alpha[0]


def test_boost_is_bounded_and_games_far_from_counting_get_none():
    result = compute_h_index(
        [
            {"bgg_id": 1, "name": "A", "plays": 5},
            {"bgg_id": 2, "name": "B", "plays": 5},
            {"bgg_id": 3, "name": "C", "plays": 1},
            {"bgg_id": 4, "name": "D", "plays": 3},
        ]
    )
    boosts = h_index_boosts(result)
    assert result["h_index"] == 3
    assert boosts[4]["points"] == 6  # 3 plays, target 4
    assert 3 not in boosts  # needs 3 more plays
    assert max(b["points"] for b in boosts.values()) <= 6


def test_no_boost_means_unchanged_ranking():
    library = [owned(1, "Alpha"), owned(2, "Zulu")]
    service = PickerService()
    criteria = PickerCriteria(players=3)
    assert [m.score for m in service.rank_matches(library, criteria)] == [
        m.score for m in service.rank_matches(library, criteria, h_index_boosts={})
    ]
