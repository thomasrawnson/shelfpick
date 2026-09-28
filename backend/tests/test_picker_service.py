from models.game import Game
from models.game import PlayerCountPoll
from services.picker_service import (
    MAX_PERSONAL_RANKING_INFLUENCE,
    PickerCriteria,
    PickerService,
)
from datetime import datetime, timedelta, timezone
from models.game_play_stats import GamePlayStats
from unittest.mock import patch


def test_filters_games_by_player_count_and_play_time():
    games = [
        Game(
            bgg_id=1,
            name="Quick Two Player Game",
            min_players=2,
            max_players=4,
            min_play_time=30,
            max_play_time=45,
            owned=True,
        ),
        Game(
            bgg_id=2,
            name="Long Game",
            min_players=2,
            max_players=4,
            min_play_time=90,
            max_play_time=120,
            owned=True,
        ),
        Game(
            bgg_id=3,
            name="Three Player Only",
            min_players=3,
            max_players=3,
            min_play_time=30,
            max_play_time=45,
            owned=True,
        ),
    ]

    service = PickerService()

    matches = service.find_matches(
        games,
        PickerCriteria(
            players=2,
            max_play_time=60,
        ),
    )

    assert [game.bgg_id for game in matches] == [1]


def test_excludes_games_that_are_not_owned():
    games = [
        Game(
            bgg_id=1,
            name="Owned Game",
            min_players=2,
            max_players=4,
            max_play_time=60,
            owned=True,
        ),
        Game(
            bgg_id=2,
            name="Wishlist Game",
            min_players=2,
            max_players=4,
            max_play_time=60,
            owned=False,
        ),
    ]

    service = PickerService()

    matches = service.find_matches(
        games,
        PickerCriteria(
            players=2,
            max_play_time=60,
        ),
    )

    assert [game.bgg_id for game in matches] == [1]


def test_filters_by_complexity_when_available():
    games = [
        Game(
            bgg_id=1,
            name="Medium Game",
            min_players=2,
            max_players=4,
            max_play_time=60,
            complexity=2.5,
            owned=True,
        ),
        Game(
            bgg_id=2,
            name="Heavy Game",
            min_players=2,
            max_players=4,
            max_play_time=60,
            complexity=4.2,
            owned=True,
        ),
    ]

    service = PickerService()

    matches = service.find_matches(
        games,
        PickerCriteria(
            players=2,
            max_play_time=60,
            max_complexity=3.0,
        ),
    )

    assert [game.bgg_id for game in matches] == [1]


def test_missing_complexity_does_not_exclude_game():
    games = [
        Game(
            bgg_id=1,
            name="Unknown Weight Game",
            min_players=2,
            max_players=4,
            max_play_time=60,
            complexity=None,
            owned=True,
        )
    ]

    service = PickerService()

    matches = service.find_matches(
        games,
        PickerCriteria(
            players=2,
            max_play_time=60,
            max_complexity=3.0,
        ),
    )

    assert [game.bgg_id for game in matches] == [1]

def test_rank_matches_returns_highest_score_first():
    games = [
        Game(
            bgg_id=1,
            name="Short Game",
            min_players=2,
            max_players=4,
            max_play_time=30,
            complexity=2.0,
            owned=True,
        ),
        Game(
            bgg_id=2,
            name="Closer Match",
            min_players=2,
            max_players=4,
            max_play_time=55,
            complexity=2.8,
            owned=True,
        ),
    ]

    service = PickerService()

    matches = service.rank_matches(
        games,
        PickerCriteria(
            players=2,
            max_play_time=60,
            max_complexity=3.0,
        ),
    )

    assert matches[0].game.bgg_id == 2
    assert matches[0].score > matches[1].score


def _personal_rankings(high_bgg_id=2, low_bgg_id=1):
    return [
        {"bgg_id": high_bgg_id, "rating": 1600, "comparisons_count": 3},
        {"bgg_id": 3, "rating": 1530, "comparisons_count": 3},
        {"bgg_id": 4, "rating": 1470, "comparisons_count": 3},
        {"bgg_id": low_bgg_id, "rating": 1400, "comparisons_count": 3},
    ]


def _ranking_candidate(bgg_id, name):
    return Game(
        bgg_id=bgg_id,
        name=name,
        min_players=2,
        max_players=4,
        max_play_time=60,
        complexity=2.5,
        owned=True,
    )


def test_personal_ranking_is_direct_bounded_and_explainable():
    games = [
        _ranking_candidate(1, "Alpha low"),
        _ranking_candidate(2, "Zulu high"),
        _ranking_candidate(3, "Middle high"),
        _ranking_candidate(4, "Middle low"),
        _ranking_candidate(5, "Unranked"),
    ]
    criteria = PickerCriteria(players=2)
    baseline = PickerService().rank_matches(games, criteria)
    ranked = PickerService().rank_matches(
        games,
        criteria,
        personal_rankings=_personal_rankings(),
    )
    baseline_by_id = {match.game.bgg_id: match for match in baseline}
    ranked_by_id = {match.game.bgg_id: match for match in ranked}

    assert baseline[0].game.bgg_id == 1
    assert ranked[0].game.bgg_id == 2
    assert (
        ranked_by_id[2].score - baseline_by_id[2].score
        == MAX_PERSONAL_RANKING_INFLUENCE
    )
    assert (
        ranked_by_id[1].score - baseline_by_id[1].score
        == -MAX_PERSONAL_RANKING_INFLUENCE
    )
    assert "Higher in your personal rankings" in ranked_by_id[2].reasons
    assert "Lower in your personal rankings" in ranked_by_id[1].reasons
    assert ranked_by_id[5].score == baseline_by_id[5].score
    assert not any("personal rankings" in reason for reason in ranked_by_id[5].reasons)


def test_sparse_tied_and_missing_personal_rankings_are_neutral():
    games = [
        _ranking_candidate(1, "First"),
        _ranking_candidate(2, "Second"),
    ]
    criteria = PickerCriteria(players=2)
    baseline = PickerService().rank_matches(games, criteria)
    sparse = PickerService().rank_matches(
        games,
        criteria,
        personal_rankings=_personal_rankings()[:3],
    )
    tied = PickerService().rank_matches(
        games,
        criteria,
        personal_rankings=[
            {**ranking, "rating": 1500}
            for ranking in _personal_rankings()
        ],
    )

    def summary(matches):
        return [
            (match.game.bgg_id, match.score, match.reasons)
            for match in matches
        ]

    assert summary(sparse) == summary(baseline)
    assert summary(tied) == summary(baseline)
    assert summary(PickerService().rank_matches(games, criteria)) == summary(baseline)


def test_subsequent_picks_use_edited_personal_ranking_order():
    games = [
        _ranking_candidate(1, "Alpha"),
        _ranking_candidate(2, "Zulu"),
        _ranking_candidate(3, "Middle high"),
        _ranking_candidate(4, "Middle low"),
    ]
    service = PickerService()
    first = service.rank_matches(
        games,
        PickerCriteria(players=2),
        personal_rankings=_personal_rankings(2, 1),
    )
    edited = service.rank_matches(
        games,
        PickerCriteria(players=2),
        personal_rankings=_personal_rankings(1, 2),
    )

    assert first[0].game.bgg_id == 2
    assert edited[0].game.bgg_id == 1


def test_personal_rankings_do_not_override_repeat_avoidance_or_hard_exclusions():
    now = datetime.now(timezone.utc)
    recent_favourite = _ranking_candidate(2, "Recent favourite")
    never_played = _ranking_candidate(5, "Never played")
    rejected_favourite = _ranking_candidate(6, "Rejected favourite")
    rejected_favourite.player_count_poll = [
        PlayerCountPoll(2, 2, 5, 3, 10)
    ]
    rankings = [
        {"bgg_id": 2, "rating": 1600, "comparisons_count": 3},
        {"bgg_id": 6, "rating": 1580, "comparisons_count": 3},
        {"bgg_id": 3, "rating": 1450, "comparisons_count": 3},
        {"bgg_id": 4, "rating": 1400, "comparisons_count": 3},
    ]

    matches = PickerService().rank_matches(
        [recent_favourite, never_played, rejected_favourite],
        PickerCriteria(players=2),
        play_stats={
            2: GamePlayStats(
                bgg_id=2,
                play_count=10,
                last_played_at=now - timedelta(days=2),
            ),
        },
        personal_rankings=rankings,
    )

    assert matches[0].game.bgg_id == 5
    assert all(match.game.bgg_id != 6 for match in matches)


def test_surprise_keeps_random_selection_with_personal_rankings():
    games = [
        _ranking_candidate(1, "First"),
        _ranking_candidate(2, "Second"),
        _ranking_candidate(3, "Third"),
        _ranking_candidate(4, "Fourth"),
    ]

    with patch("services.picker_service.random.shuffle") as shuffle:
        matches = PickerService().rank_matches(
            games,
            PickerCriteria(
                players=2,
                mode="surprise",
            ),
            personal_rankings=_personal_rankings(),
        )

    shuffle.assert_called_once()
    assert len(matches) == 4


def test_rank_match_contains_explanation():
    game = Game(
        bgg_id=1,
        name="Example Game",
        min_players=2,
        max_players=4,
        max_play_time=60,
        complexity=2.5,
        owned=True,
    )

    service = PickerService()

    matches = service.rank_matches(
        [game],
        PickerCriteria(
            players=2,
            max_play_time=90,
            max_complexity=3.0,
        ),
    )

    match = matches[0]

    assert "Supports 2 players" in match.reasons
    assert "Fits within 90 minutes" in match.reasons
    assert "Complexity 2.5 fits preference" in match.reasons


def test_score_never_exceeds_100():
    game = Game(
        bgg_id=1,
        name="Perfect Match",
        min_players=2,
        max_players=4,
        max_play_time=60,
        complexity=3.0,
        owned=True,
    )

    service = PickerService()

    matches = service.rank_matches(
        [game],
        PickerCriteria(
            players=2,
            max_play_time=60,
            max_complexity=3.0,
        ),
    )

    assert matches[0].score <= 100

def test_game_not_played_recently_scores_higher():
    service = PickerService()

    recent_game = Game(
        bgg_id=1,
        name="Recent Game",
        min_players=2,
        max_players=4,
        min_play_time=30,
        max_play_time=60,
        complexity=2.0,
        owned=True,
    )

    neglected_game = Game(
        bgg_id=2,
        name="Neglected Game",
        min_players=2,
        max_players=4,
        min_play_time=30,
        max_play_time=60,
        complexity=2.0,
        owned=True,
    )

    now = datetime.now(timezone.utc)

    play_stats = {
        1: GamePlayStats(
            bgg_id=1,
            play_count=10,
            last_played_at=(
                now - timedelta(days=2)
            ),
        ),
        2: GamePlayStats(
            bgg_id=2,
            play_count=3,
            last_played_at=(
                now - timedelta(days=200)
            ),
        ),
    }

    matches = service.rank_matches(
        [recent_game, neglected_game],
        PickerCriteria(
            players=2,
            max_play_time=60,
        ),
        play_stats=play_stats,
    )

    assert matches[0].game.name == (
        "Neglected Game"
    )

    assert (
        "Hasn't been played in over 6 months"
        in matches[0].reasons
    )

def test_never_played_game_beats_recently_played_game():
    service = PickerService()

    never_played = Game(
        bgg_id=1,
        name="Never Played",
        min_players=2,
        max_players=4,
        max_play_time=60,
        complexity=2.5,
        owned=True,
    )

    recent_game = Game(
        bgg_id=2,
        name="Recent Game",
        min_players=2,
        max_players=4,
        max_play_time=60,
        complexity=2.5,
        owned=True,
    )

    play_stats = {
        2: GamePlayStats(
            bgg_id=2,
            play_count=5,
            last_played_at=(
                datetime.now(timezone.utc)
                - timedelta(days=2)
            ),
        )
    }

    matches = service.rank_matches(
        [recent_game, never_played],
        PickerCriteria(
            players=2,
            max_play_time=60,
            max_complexity=3.0,
        ),
        play_stats=play_stats,
    )

    assert matches[0].game.bgg_id == 1
    assert "Hasn't been played yet" in matches[0].reasons
    assert "Played recently" in matches[1].reasons

def test_preferred_mechanic_increases_score():
    service = PickerService()

    preferred_game = Game(
        bgg_id=1,
        name="Deck Builder",
        min_players=2,
        max_players=4,
        max_play_time=60,
        complexity=2.5,
        owned=True,
        mechanics=[
            "Deck Building",
        ],
    )

    other_game = Game(
        bgg_id=2,
        name="Other Game",
        min_players=2,
        max_players=4,
        max_play_time=60,
        complexity=2.5,
        owned=True,
        mechanics=[
            "Worker Placement",
        ],
    )

    matches = service.rank_matches(
        [
            other_game,
            preferred_game,
        ],
        PickerCriteria(
            players=2,
            max_play_time=60,
            max_complexity=3.0,
            preferred_mechanics=[
                "Deck Building"
            ],
        ),
    )

    assert matches[0].game.bgg_id == 1

    assert (
        "Matches preferred mechanic: Deck Building"
        in matches[0].reasons
    )


def test_preferred_category_increases_score():
    service = PickerService()

    preferred_game = Game(
        bgg_id=1,
        name="Economic Game",
        min_players=2,
        max_players=4,
        max_play_time=60,
        complexity=2.5,
        owned=True,
        categories=[
            "Economic",
        ],
    )

    other_game = Game(
        bgg_id=2,
        name="Adventure Game",
        min_players=2,
        max_players=4,
        max_play_time=60,
        complexity=2.5,
        owned=True,
        categories=[
            "Adventure",
        ],
    )

    matches = service.rank_matches(
        [
            other_game,
            preferred_game,
        ],
        PickerCriteria(
            players=2,
            max_play_time=60,
            max_complexity=3.0,
            preferred_categories=[
                "Economic"
            ],
        ),
    )

    assert matches[0].game.bgg_id == 1

    assert (
        "Matches preferred category: Economic"
        in matches[0].reasons
    )


def test_preferences_are_case_insensitive():
    service = PickerService()

    game = Game(
        bgg_id=1,
        name="Deck Builder",
        min_players=2,
        max_players=4,
        max_play_time=60,
        complexity=2.5,
        owned=True,
        mechanics=[
            "Deck Building",
        ],
    )

    matches = service.rank_matches(
        [game],
        PickerCriteria(
            players=2,
            preferred_mechanics=[
                "deck building"
            ],
        ),
    )

    assert (
        "Matches preferred mechanic: Deck Building"
        in matches[0].reasons
    )


def test_preferences_do_not_hard_filter_games():
    service = PickerService()

    matching_game = Game(
        bgg_id=1,
        name="Deck Builder",
        min_players=2,
        max_players=4,
        max_play_time=60,
        owned=True,
        mechanics=[
            "Deck Building",
        ],
    )

    non_matching_game = Game(
        bgg_id=2,
        name="Worker Placement Game",
        min_players=2,
        max_players=4,
        max_play_time=60,
        owned=True,
        mechanics=[
            "Worker Placement",
        ],
    )

    matches = service.rank_matches(
        [
            matching_game,
            non_matching_game,
        ],
        PickerCriteria(
            players=2,
            preferred_mechanics=[
                "Deck Building"
            ],
        ),
    )

    assert len(matches) == 2
    assert matches[0].game.bgg_id == 1


def test_category_and_mechanic_bonus_is_capped_at_ten():
    service = PickerService()

    game = Game(
        bgg_id=1,
        name="Perfect Preference Match",
        min_players=2,
        max_players=4,
        max_play_time=60,
        complexity=3.0,
        owned=True,
        categories=[
            "Economic",
            "Strategy",
        ],
        mechanics=[
            "Deck Building",
            "Hand Management",
        ],
    )

    matches = service.rank_matches(
        [game],
        PickerCriteria(
            players=2,
            max_play_time=60,
            max_complexity=3.0,
            preferred_categories=[
                "Economic",
                "Strategy",
            ],
            preferred_mechanics=[
                "Deck Building",
                "Hand Management",
            ],
        ),
    )

    assert matches[0].score <= 100

def test_new_game_for_selected_group_gets_bonus():
    service = PickerService()

    new_for_group = Game(
        bgg_id=1,
        name="New For Group",
        min_players=2,
        max_players=4,
        max_play_time=60,
        complexity=2.5,
        owned=True,
    )

    recent_for_group = Game(
        bgg_id=2,
        name="Recent For Group",
        min_players=2,
        max_players=4,
        max_play_time=60,
        complexity=2.5,
        owned=True,
    )

    now = datetime.now(
        timezone.utc
    )

    group_play_stats = {
        2: GamePlayStats(
            bgg_id=2,
            play_count=2,
            last_played_at=(
                now
                - timedelta(
                    days=2
                )
            ),
        ),
    }

    matches = service.rank_matches(
        [
            recent_for_group,
            new_for_group,
        ],
        PickerCriteria(
            players=2,
            player_ids=[
                1,
                2,
            ],
        ),
        group_play_stats=(
            group_play_stats
        ),
    )

    assert (
        matches[0].game.bgg_id
        == 1
    )

    assert (
        "This group hasn't played it together yet"
        in matches[0].reasons
    )


def test_recent_group_play_gets_penalty():
    service = PickerService()

    game = Game(
        bgg_id=1,
        name="Recent Together",
        min_players=2,
        max_players=4,
        max_play_time=60,
        owned=True,
    )

    matches = service.rank_matches(
        [game],
        PickerCriteria(
            players=2,
            player_ids=[
                1,
                2,
            ],
        ),
        group_play_stats={
            1: GamePlayStats(
                bgg_id=1,
                play_count=3,
                last_played_at=(
                    datetime.now(
                        timezone.utc
                    )
                    - timedelta(
                        days=2
                    )
                ),
            ),
        },
    )

    assert (
        "This group played it recently"
        in matches[0].reasons
    )

def test_best_player_count_gets_bonus():
    service = PickerService()

    best_count_game = Game(
        bgg_id=1,
        name="Best At Two",
        min_players=2,
        max_players=4,
        max_play_time=60,
        owned=True,
        best_player_counts=[
            2,
        ],
        recommended_player_counts=[
            2,
            3,
        ],
        player_count_poll=[
            PlayerCountPoll(2, 60, 30, 10, 100)
        ],
    )

    supported_only_game = Game(
        bgg_id=2,
        name="Supported At Two",
        min_players=2,
        max_players=4,
        max_play_time=60,
        owned=True,
    )

    matches = service.rank_matches(
        [
            supported_only_game,
            best_count_game,
        ],
        PickerCriteria(
            players=2,
            max_play_time=60,
        ),
    )

    assert (
        matches[0].game.bgg_id
        == 1
    )

    assert (
        any(
            reason.startswith(
                "Best at 2 players"
            )
            for reason in matches[0].reasons
        )
    )


def test_recommended_player_count_gets_bonus():
    service = PickerService()

    recommended_game = Game(
        bgg_id=1,
        name="Recommended At Three",
        min_players=2,
        max_players=4,
        max_play_time=60,
        owned=True,
        recommended_player_counts=[
            3,
        ],
        player_count_poll=[
            PlayerCountPoll(3, 20, 60, 20, 100)
        ],
    )

    supported_only_game = Game(
        bgg_id=2,
        name="Supported At Three",
        min_players=2,
        max_players=4,
        max_play_time=60,
        owned=True,
    )

    matches = service.rank_matches(
        [
            supported_only_game,
            recommended_game,
        ],
        PickerCriteria(
            players=3,
            max_play_time=60,
        ),
    )

    assert (
        matches[0].game.bgg_id
        == 1
    )

    assert (
        any(
            reason.startswith(
                "Recommended at 3 players"
            )
            for reason in matches[0].reasons
        )
    )


def _game_with_two_player_poll(
    not_recommended_votes: int,
    total_votes: int,
    bgg_id: int = 1,
) -> Game:
    positive_votes = (
        total_votes
        - not_recommended_votes
    )

    return Game(
        bgg_id=bgg_id,
        name=f"Poll Game {bgg_id}",
        min_players=2,
        max_players=5,
        max_play_time=60,
        owned=True,
        player_count_poll=[
            PlayerCountPoll(
                player_count=2,
                best_votes=0,
                recommended_votes=(
                    positive_votes
                ),
                not_recommended_votes=(
                    not_recommended_votes
                ),
                total_votes=total_votes,
            )
        ],
    )


def test_exact_player_count_ranking_is_deterministic():
    games = [
        _game_with_two_player_poll(10, 100, bgg_id=2),
        _game_with_two_player_poll(10, 100, bgg_id=1),
    ]
    games[0].name = "Beta"
    games[1].name = "Alpha"
    criteria = PickerCriteria(players=2)
    service = PickerService()

    first = service.rank_matches(games, criteria)
    second = service.rank_matches(games, criteria)

    assert [match.game.bgg_id for match in first] == [1, 2]
    assert [match.game.bgg_id for match in second] == [1, 2]


def test_study_in_emerald_is_excluded_at_two_players():
    game = Game(
        bgg_id=178054,
        name="A Study in Emerald (Second Edition)",
        min_players=2,
        max_players=5,
        max_play_time=60,
        owned=True,
        player_count_poll=[
            PlayerCountPoll(2, 0, 9, 40, 49)
        ],
    )

    matches = PickerService().rank_matches(
        [game],
        PickerCriteria(players=2),
    )

    assert matches == []


def test_below_30_percent_not_recommended_remains_eligible():
    game = _game_with_two_player_poll(299, 1000)

    match = PickerService().rank_matches(
        [game],
        PickerCriteria(players=2),
    )[0]

    assert match.score == 95
    assert any(
        reason.startswith("Recommended at 2 players")
        for reason in match.reasons
    )


def test_30_percent_not_recommended_is_excluded():
    game = _game_with_two_player_poll(30, 100)

    matches = PickerService().rank_matches(
        [game],
        PickerCriteria(players=2),
    )

    assert matches == []


def test_above_30_percent_not_recommended_is_excluded():
    game = _game_with_two_player_poll(31, 100)

    matches = PickerService().rank_matches(
        [game],
        PickerCriteria(players=2),
    )

    assert matches == []


def test_50_percent_not_recommended_is_excluded():
    game = _game_with_two_player_poll(50, 100)

    matches = PickerService().rank_matches(
        [game],
        PickerCriteria(players=2),
    )

    assert matches == []


def test_expansions_are_never_picker_candidates():
    game = Game(
        bgg_id=999999,
        name="Example Expansion",
        min_players=2,
        max_players=4,
        max_play_time=60,
        complexity=2.0,
        owned=True,
        is_expansion=True,
    )

    matches = PickerService().find_matches(
        [game],
        PickerCriteria(
            players=2,
            max_play_time=60,
            max_complexity=3.0,
        ),
    )

    assert matches == []


def test_cooperative_filter_only_returns_cooperative_games():
    cooperative = Game(
        bgg_id=1,
        name="Cooperative Game",
        min_players=1,
        max_players=4,
        owned=True,
        mechanics=["Cooperative Game"],
    )
    competitive = Game(
        bgg_id=2,
        name="Competitive Game",
        min_players=1,
        max_players=4,
        owned=True,
        mechanics=["Area Majority / Influence"],
    )

    matches = PickerService().find_matches(
        [cooperative, competitive],
        PickerCriteria(
            players=2,
            play_style="cooperative",
        ),
    )

    assert matches == [cooperative]


def test_competitive_filter_excludes_cooperative_games():
    cooperative = Game(
        bgg_id=1,
        name="Cooperative Game",
        min_players=1,
        max_players=4,
        owned=True,
        mechanics=["Cooperative Game"],
    )
    competitive = Game(
        bgg_id=2,
        name="Competitive Game",
        min_players=1,
        max_players=4,
        owned=True,
        mechanics=["Auction / Bidding"],
    )

    matches = PickerService().find_matches(
        [cooperative, competitive],
        PickerCriteria(
            players=2,
            play_style="competitive",
        ),
    )

    assert matches == [competitive]


def test_youngest_player_age_requires_known_suitable_age():
    suitable = Game(
        bgg_id=1,
        name="Family Game",
        min_players=1,
        max_players=4,
        min_age=8,
        owned=True,
    )
    too_old = Game(
        bgg_id=2,
        name="Older Game",
        min_players=1,
        max_players=4,
        min_age=12,
        owned=True,
    )
    unknown = Game(
        bgg_id=3,
        name="Unknown Age",
        min_players=1,
        max_players=4,
        owned=True,
    )

    matches = PickerService().find_matches(
        [suitable, too_old, unknown],
        PickerCriteria(
            players=2,
            youngest_player_age=10,
        ),
    )

    assert matches == [suitable]


def test_low_sample_rejection_does_not_exclude_game():
    game = _game_with_two_player_poll(5, 9)

    match = PickerService().rank_matches(
        [game],
        PickerCriteria(players=2),
    )[0]

    assert (
        "Limited voting data at 2 players"
        in match.reasons
    )


def test_missing_poll_data_falls_back_to_supported_range():
    game = Game(
        bgg_id=1,
        name="No Poll Data",
        min_players=2,
        max_players=4,
        owned=True,
    )

    matches = PickerService().rank_matches(
        [game],
        PickerCriteria(players=2),
    )

    assert len(matches) == 1
    assert matches[0].score == 90


def test_poll_for_different_count_does_not_affect_selection():
    game = Game(
        bgg_id=1,
        name="Rejected Only At Three",
        min_players=2,
        max_players=4,
        owned=True,
        player_count_poll=[
            PlayerCountPoll(3, 0, 2, 18, 20)
        ],
    )

    matches = PickerService().rank_matches(
        [game],
        PickerCriteria(players=2),
    )

    assert len(matches) == 1

    three_player_matches = (
        PickerService().rank_matches(
            [game],
            PickerCriteria(players=3),
        )
    )

    assert three_player_matches == []


def test_no_match_guidance_never_relaxes_player_count_fit():
    rejected = Game(
        bgg_id=1,
        name="Rejected At Two",
        min_players=2,
        max_players=4,
        max_play_time=30,
        complexity=2.0,
        owned=True,
        player_count_poll=[
            PlayerCountPoll(2, 0, 2, 18, 20)
        ],
    )

    guidance = PickerService().get_no_match_guidance(
        [rejected],
        PickerCriteria(
            players=2,
            max_play_time=60,
            max_complexity=3.0,
        ),
    )

    assert guidance.player_count_exclusions == 1
    assert guidance.owned_game_count == 1
    assert guidance.can_relax_time is False
    assert guidance.can_relax_complexity is False
    assert guidance.can_relax_both is False


def test_no_match_guidance_identifies_safe_relaxations():
    too_long = Game(
        bgg_id=1,
        name="Long but Suitable",
        min_players=2,
        max_players=4,
        max_play_time=90,
        complexity=2.0,
        owned=True,
        player_count_poll=[
            PlayerCountPoll(2, 5, 12, 3, 20)
        ],
    )

    too_complex = Game(
        bgg_id=2,
        name="Heavy but Suitable",
        min_players=2,
        max_players=4,
        max_play_time=45,
        complexity=4.0,
        owned=True,
        player_count_poll=[
            PlayerCountPoll(2, 5, 12, 3, 20)
        ],
    )

    guidance = PickerService().get_no_match_guidance(
        [too_long, too_complex],
        PickerCriteria(
            players=2,
            max_play_time=60,
            max_complexity=3.0,
        ),
    )

    assert guidance.player_count_exclusions == 0
    assert guidance.owned_game_count == 2
    assert guidance.can_relax_time is True
    assert guidance.can_relax_complexity is True
    assert guidance.can_relax_both is True


def test_no_match_guidance_reports_an_empty_owned_collection():
    guidance = PickerService().get_no_match_guidance(
        [],
        PickerCriteria(players=2),
    )

    assert guidance.owned_game_count == 0
    assert guidance.player_count_exclusions == 0


def test_try_another_pool_never_contains_rejected_game():
    suitable = Game(
        bgg_id=1,
        name="Suitable At Two",
        min_players=2,
        max_players=4,
        owned=True,
        player_count_poll=[
            PlayerCountPoll(2, 5, 12, 3, 20)
        ],
    )

    rejected = Game(
        bgg_id=2,
        name="Rejected At Two",
        min_players=2,
        max_players=4,
        owned=True,
        player_count_poll=[
            PlayerCountPoll(2, 0, 2, 18, 20)
        ],
    )

    matches = PickerService().rank_matches(
        [suitable, rejected],
        PickerCriteria(players=2),
    )

    assert [
        match.game.bgg_id
        for match in matches
    ] == [1]



def test_complexity_bands_match_display_labels():
    games = [
        Game(bgg_id=101, name="Light Game", min_players=2, max_players=4, max_play_time=60, complexity=2.0, owned=True),
        Game(bgg_id=102, name="Medium Game", min_players=2, max_players=4, max_play_time=60, complexity=2.7, owned=True),
        Game(bgg_id=103, name="Heavy Game", min_players=2, max_players=4, max_play_time=60, complexity=3.6, owned=True),
    ]

    service = PickerService()

    light = service.find_matches(games, PickerCriteria(players=2, complexity_band="light"))
    medium = service.find_matches(games, PickerCriteria(players=2, complexity_band="medium"))
    heavy = service.find_matches(games, PickerCriteria(players=2, complexity_band="heavy"))

    assert [game.bgg_id for game in light] == [101]
    assert [game.bgg_id for game in medium] == [102]
    assert [game.bgg_id for game in heavy] == [103]


def test_explicit_complexity_band_excludes_unknown_complexity():
    game = Game(
        bgg_id=104,
        name="Unknown Complexity",
        min_players=2,
        max_players=4,
        max_play_time=60,
        complexity=None,
        owned=True,
    )

    matches = PickerService().find_matches(
        [game],
        PickerCriteria(players=2, complexity_band="heavy"),
    )

    assert matches == []


def test_heavy_complexity_does_not_return_medium_game():
    medium_game = Game(
        bgg_id=105,
        name="Boss Monster Example",
        min_players=2,
        max_players=4,
        max_play_time=60,
        complexity=2.7,
        owned=True,
    )

    matches = PickerService().find_matches(
        [medium_game],
        PickerCriteria(players=3, complexity_band="heavy"),
    )

    assert matches == []
