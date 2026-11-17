from types import SimpleNamespace as NS

import pytest

from services.play_results import normalize_results, resolve_outcome


def p(name, **kw):
    return {"name": name, **kw}


def play(outcome_type="competitive", coop_result=None, rows=()):
    return NS(
        outcome_type=outcome_type,
        coop_result=coop_result,
        participants=[
            NS(
                score=r.get("score"),
                is_winner=r.get("is_winner", False),
                team=r.get("team"),
                rank=r.get("rank"),
            )
            for r in rows
        ],
    )


def outcomes(pl, coop_game=False):
    return [resolve_outcome(x, pl, coop_game) for x in pl.participants]


def test_cooperative_win_and_loss_apply_to_everyone():
    won = play("cooperative", "won", [{}, {}, {}])
    lost = play("cooperative", "lost", [{}, {}])
    assert outcomes(won) == ["win"] * 3
    assert outcomes(lost) == ["loss"] * 2


def test_cooperative_without_result_is_unknown():
    assert outcomes(play("cooperative", None, [{}, {}])) == ["unknown"] * 2


def test_team_win_gives_every_member_the_win():
    pl = play("team", None, [
        {"team": "Red", "is_winner": True},
        {"team": "Red", "is_winner": True},
        {"team": "Blue"},
    ])
    assert outcomes(pl) == ["win", "win", "loss"]


def test_two_winning_teams_draw():
    pl = play("team", None, [
        {"team": "Red", "is_winner": True},
        {"team": "Blue", "is_winner": True},
    ])
    assert outcomes(pl) == ["draw", "draw"]


def test_rank_one_wins_and_shared_rank_one_draws():
    assert outcomes(play(rows=[{"rank": 1}, {"rank": 2}, {"rank": 3}])) == [
        "win", "loss", "loss",
    ]
    assert outcomes(play(rows=[{"rank": 1}, {"rank": 1}, {"rank": 3}])) == [
        "draw", "draw", "loss",
    ]


def test_no_result_stays_unknown():
    assert outcomes(play(rows=[{}, {}])) == ["unknown", "unknown"]


def test_legacy_flags_keep_their_old_meaning():
    pl = play(rows=[{"is_winner": True, "score": 5}, {"is_winner": True, "score": 5}])
    assert outcomes(pl) == ["draw", "draw"]
    coop = play(rows=[{"is_winner": True, "score": 5}, {"is_winner": True, "score": 5}])
    assert outcomes(coop, coop_game=True) == ["win", "win"]


def test_solo_uses_shared_result():
    assert outcomes(play("solo", "lost", [{}])) == ["loss"]


def test_normalize_cooperative_derives_winner_flags():
    result, rows = normalize_results("cooperative", "won", [p("A"), p("B")])
    assert result == "won"
    assert [r["is_winner"] for r in rows] == [True, True]
    _, rows = normalize_results("cooperative", "lost", [p("A")])
    assert rows[0]["is_winner"] is False


@pytest.mark.parametrize(
    "outcome_type, coop_result, rows",
    [
        ("cooperative", None, [p("A"), p("B")]),
        ("cooperative", "won", [p("A", is_winner=True)]),
        ("cooperative", "won", [p("A", rank=1)]),
        ("competitive", "won", [p("A")]),
        ("solo", "won", [p("A"), p("B")]),
        ("team", None, [p("A", team="Red"), p("B", team="red")]),
        ("team", None, [p("A", team="Red"), p("B")]),
        ("team", None, [p("A", team="R", is_winner=True), p("B", team="R"), p("C", team="B")]),
        ("team", None, [p("A", team="R", rank=1), p("B", team="R", rank=2), p("C", team="B", rank=3)]),
        ("competitive", None, [p("A", team="Red"), p("B")]),
        ("competitive", None, [p("A", rank=1), p("B")]),
        ("competitive", None, [p("A", rank=0), p("B", rank=1)]),
        ("competitive", None, [p("A", rank=2, is_winner=True), p("B", rank=1)]),
        ("mystery", None, [p("A")]),
    ],
)
def test_invalid_combinations_are_rejected(outcome_type, coop_result, rows):
    with pytest.raises(ValueError):
        normalize_results(outcome_type, coop_result, rows)


def test_ranks_derive_winners_and_ties():
    _, rows = normalize_results(
        "competitive", None, [p("A", rank=1), p("B", rank=1), p("C", rank=3)]
    )
    assert [r["is_winner"] for r in rows] == [True, True, False]


def test_team_names_merge_case_insensitively():
    _, rows = normalize_results(
        "team", None,
        [p("A", team="Red"), p("B", team=" red "), p("C", team="Blue")],
    )
    assert [r["team"] for r in rows] == ["Red", "Red", "Blue"]
