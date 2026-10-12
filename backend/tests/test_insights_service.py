from datetime import datetime, timezone

import pytest

from models.collection_insights import (
    GamePlaySummary,
    LastPlayedGame,
    PlayerSummary,
)
from services.insights_service import (
    InsightsService,
)


class FakeInsightsRepository:
    def __init__(self):
        self.recap_bounds = None
    def total_owned_games(self):
        return 194

    def total_plays(self):
        return 12

    def played_games_count(self):
        return 44

    def historical_played_games_count(self):
        return 47

    def total_duration_minutes(self):
        return 720

    def duration_plays(self):
        return 8

    def average_duration_minutes(self):
        return 60

    def get_most_played(self):
        return GamePlaySummary(
            bgg_id=167791,
            name="Terraforming Mars",
            play_count=4,
        )

    def get_last_played(self):
        return LastPlayedGame(
            bgg_id=167791,
            name="Terraforming Mars",
            played_at=datetime.now(
                timezone.utc
            ),
        )

    def never_played_count(self):
        return 150

    def get_frequent_players(self):
        return [
            PlayerSummary(
                id=1,
                name="Tom",
                play_count=10,
                win_count=4,
            ),
            PlayerSummary(
                id=2,
                name="Wales",
                play_count=8,
                win_count=3,
            ),
        ]
    
    def get_monthly_activity(self):
        from models.collection_insights import (
            MonthlyActivity,
        )

        return MonthlyActivity(
            plays=12,
            unique_games=7,
            new_games=3,
            repeat_plays=9,
            recent_plays=[],
        )


    def get_neglected_games(self):
        return []


    def get_top_games_by_player(self):
        return []


    def get_common_groups(self):
        return []

    def get_monthly_recap(self, start, end):
        from models.collection_insights import MonthlyRecapGame

        self.recap_bounds = (start, end)
        return {
            "total_plays": 3,
            "unique_games": 2,
            "total_duration_minutes": 95,
            "duration_plays": 2,
            "games": [
                MonthlyRecapGame(2, "Alpha", 2, "https://example.com/alpha.jpg"),
                MonthlyRecapGame(1, "Beta", 1, "javascript:alert(1)"),
            ],
        }


def test_get_collection_insights():
    service = InsightsService(
        FakeInsightsRepository()
    )

    insights = (
        service.get_collection_insights()
    )

    assert (
        insights.frequent_players[0].id
        == 1
    )
    assert insights.total_games == 194
    assert insights.total_plays == 12

    assert (
        insights.played_games_count
        == 44
    )

    assert (
        insights.historical_played_games_count
        == 47
    )

    assert (
        insights.collection_played_percentage
        == 23
    )

    assert (
        insights.total_duration_minutes
        == 720
    )

    assert insights.duration_plays == 8

    assert (
        insights.average_duration_minutes
        == 60
    )

    assert insights.most_played is not None

    assert (
        insights.most_played.name
        == "Terraforming Mars"
    )

    assert (
        insights.most_played.play_count
        == 4
    )

    assert insights.last_played is not None

    assert (
        insights.last_played.name
        == "Terraforming Mars"
    )

    assert (
        insights.never_played_count
        == 150
    )

    assert (
        len(insights.frequent_players)
        == 2
    )

    assert (
        insights.frequent_players[0].name
        == "Tom"
    )

    assert (
        insights.frequent_players[0].win_count
        == 4
    )


def test_monthly_recap_uses_timezone_boundaries_and_truthful_duration():
    repository = FakeInsightsRepository()
    recap = InsightsService(repository).get_monthly_recap(
        "2026-03", "America/New_York"
    )

    assert repository.recap_bounds == (
        datetime(2026, 3, 1, 5, tzinfo=timezone.utc),
        datetime(2026, 4, 1, 4, tzinfo=timezone.utc),
    )
    assert recap.month_label == "March 2026"
    assert recap.total_plays == 3
    assert recap.total_duration_minutes == 95
    assert recap.duration_plays == 2
    assert recap.most_played.name == "Alpha"
    assert recap.collage_games[1].image_url is None


@pytest.mark.parametrize(
    ("month", "timezone_name", "message"),
    [
        ("2026-13", "Europe/London", "Month must use YYYY-MM format"),
        ("October", "Europe/London", "Month must use YYYY-MM format"),
        ("2026-10", "Not/A_Timezone", "valid IANA timezone"),
    ],
)
def test_monthly_recap_rejects_invalid_inputs(month, timezone_name, message):
    with pytest.raises(ValueError, match=message):
        InsightsService(FakeInsightsRepository()).get_monthly_recap(
            month, timezone_name
        )


def test_monthly_recap_preserves_empty_and_one_play_months():
    from models.collection_insights import MonthlyRecapGame

    class RecapRepository(FakeInsightsRepository):
        def __init__(self, result):
            super().__init__()
            self.result = result

        def get_monthly_recap(self, start, end):
            self.recap_bounds = (start, end)
            return self.result

    empty = InsightsService(RecapRepository({
        "total_plays": 0,
        "unique_games": 0,
        "total_duration_minutes": None,
        "duration_plays": 0,
        "games": [],
    })).get_monthly_recap("2026-09", "Europe/London")
    one_game = MonthlyRecapGame(1, "Solo", 1, None)
    sparse = InsightsService(RecapRepository({
        "total_plays": 1,
        "unique_games": 1,
        "total_duration_minutes": None,
        "duration_plays": 0,
        "games": [one_game],
    })).get_monthly_recap("2026-09", "Europe/London")

    assert empty.most_played is None
    assert empty.collage_games == []
    assert empty.total_duration_minutes is None
    assert sparse.most_played == one_game
    assert sparse.duration_plays == 0
