from datetime import datetime, timezone

from fastapi.testclient import TestClient

from api.main import (
    app,
    get_collection_service,
    get_game_service,
    get_picker_analytics_repository,
    get_picker_play_repository,
    get_play_repository,
    get_play_service,
)
from api.current_user import (
    get_current_user,
)
from api.dependencies import get_live_timer_service
from database.models import User
from models.game import Game
from models.game import PlayerCountPoll
from models.play import Play


client = TestClient(app)


class FakeLiveTimerService:
    def __init__(self):
        self.started = []

    def get_active(self):
        return None

    def start(self, bgg_id, participant_names, location):
        self.started.append((bgg_id, participant_names, location))
        return {"public_id": "timer-1", "status": "running"}


class FakePickerAnalyticsRepository:
    def __init__(self):
        self.sessions = []
        self.events = []

    def create_session(
        self,
        criteria,
        recommendation_bgg_ids,
    ):
        self.sessions.append(
            {
                "criteria": criteria,
                "recommendation_bgg_ids": (
                    recommendation_bgg_ids
                ),
            }
        )
        return (
            "00000000-0000-0000-0000-000000000001"
        )

    def record_event(
        self,
        public_id,
        event_type,
        bgg_id=None,
        position=None,
    ):
        self.events.append(
            {
                "public_id": public_id,
                "event_type": event_type,
                "bgg_id": bgg_id,
                "position": position,
            }
        )
        return True


def test_get_game_returns_game():
    class FakeGameService:
        def get_game(
            self,
            bgg_id: int,
        ):
            return Game(
                bgg_id=bgg_id,
                name="Gloomhaven",
                year_published=2017,
                min_players=1,
                max_players=4,
                complexity=3.86,
                rating=8.5,
            )

    app.dependency_overrides[
        get_game_service
    ] = lambda: FakeGameService()

    try:
        response = client.get(
            "/games/174430"
        )

        assert (
            response.status_code
            == 200
        )

        data = response.json()

        assert (
            data["bgg_id"]
            == 174430
        )

        assert (
            data["name"]
            == "Gloomhaven"
        )

        assert (
            data["min_players"]
            == 1
        )

        assert (
            data["max_players"]
            == 4
        )

    finally:
        app.dependency_overrides.clear()


def test_get_missing_game_returns_404():
    class FakeGameService:
        def get_game(
            self,
            bgg_id: int,
        ):
            return None

    app.dependency_overrides[
        get_game_service
    ] = lambda: FakeGameService()

    try:
        response = client.get(
            "/games/999999"
        )

        assert (
            response.status_code
            == 404
        )

        assert response.json() == {
            "detail": "Game not found"
        }

    finally:
        app.dependency_overrides.clear()


def test_get_games():
    class FakeGameService:
        def get_games(
            self,
        ):
            return [
                Game(
                    bgg_id=174430,
                    name="Gloomhaven",
                ),
                Game(
                    bgg_id=167791,
                    name="Terraforming Mars",
                ),
            ]

    app.dependency_overrides[
        get_game_service
    ] = lambda: FakeGameService()

    try:
        response = client.get(
            "/games"
        )

        assert (
            response.status_code
            == 200
        )

        data = response.json()

        assert len(data) == 2

        assert (
            data[0]["name"]
            == "Gloomhaven"
        )

        assert (
            data[1]["name"]
            == "Terraforming Mars"
        )

    finally:
        app.dependency_overrides.clear()


def test_picker_returns_ranked_matches():
    class FakeGameService:
        def get_games(
            self,
        ):
            return [
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
                    name="Best Match",
                    min_players=2,
                    max_players=4,
                    max_play_time=55,
                    complexity=2.8,
                    owned=True,
                ),
                Game(
                    bgg_id=3,
                    name="Too Long",
                    min_players=2,
                    max_players=4,
                    max_play_time=180,
                    complexity=2.5,
                    owned=True,
                ),
            ]

    class FakePlayRepository:
        def get_players(
            self,
        ):
            return []

        def get_group_game_play_stats(
            self,
            player_ids,
        ):
            return {}

        def get_game_play_stats(
            self,
        ):
            return {}

    app.dependency_overrides[
        get_game_service
    ] = lambda: FakeGameService()

    app.dependency_overrides[
        get_picker_play_repository
    ] = lambda: FakePlayRepository()

    analytics = (
        FakePickerAnalyticsRepository()
    )
    app.dependency_overrides[
        get_picker_analytics_repository
    ] = lambda: analytics

    try:
        response = client.get(
            "/picker",
            params={
                "players": 2,
                "max_play_time": 60,
                "max_complexity": 3.0,
            },
        )

    finally:
        app.dependency_overrides.clear()

    assert (
        response.status_code
        == 200
    )

    data = response.json()

    assert len(data) == 2

    assert (
        data[0]["game"]["bgg_id"]
        == 2
    )

    assert (
        data[0]["game"]["name"]
        == "Best Match"
    )

    assert (
        data[0]["score"]
        > data[1]["score"]
    )

    assert (
        "Supports 2 players"
        in data[0]["reasons"]
    )

    assert len(analytics.sessions) == 1
    assert (
        analytics.sessions[0][
            "recommendation_bgg_ids"
        ]
        == [2, 1]
    )


def test_picker_guidance_explains_safe_no_match_options():
    class FakeGameService:
        def get_games(
            self,
        ):
            return [
                Game(
                    bgg_id=1,
                    name="Rejected At Two",
                    min_players=2,
                    max_players=4,
                    max_play_time=30,
                    complexity=2.0,
                    owned=True,
                    player_count_poll=[
                        PlayerCountPoll(
                            2,
                            0,
                            2,
                            18,
                            20,
                        )
                    ],
                ),
                Game(
                    bgg_id=2,
                    name="Long but Suitable",
                    min_players=2,
                    max_players=4,
                    max_play_time=90,
                    complexity=2.0,
                    owned=True,
                    player_count_poll=[
                        PlayerCountPoll(
                            2,
                            5,
                            12,
                            3,
                            20,
                        )
                    ],
                ),
            ]

    class FakePlayRepository:
        def get_players(
            self,
        ):
            return []

        def get_group_game_play_stats(
            self,
            player_ids,
        ):
            return {}

        def get_game_play_stats(
            self,
        ):
            return {}

    app.dependency_overrides[
        get_game_service
    ] = lambda: FakeGameService()

    app.dependency_overrides[
        get_picker_play_repository
    ] = lambda: FakePlayRepository()

    analytics = (
        FakePickerAnalyticsRepository()
    )
    app.dependency_overrides[
        get_picker_analytics_repository
    ] = lambda: analytics

    try:
        response = client.get(
            "/picker",
            params={
                "players": 2,
                "max_play_time": 60,
                "max_complexity": 3.0,
                "include_guidance": True,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200

    data = response.json()

    assert data["matches"] == []
    assert data["guidance"] == {
        "owned_game_count": 2,
        "player_count_exclusions": 1,
        "can_relax_time": True,
        "can_relax_complexity": False,
        "can_relax_both": True,
    }
    assert data["session_id"] == (
        "00000000-0000-0000-0000-000000000001"
    )
    assert (
        analytics.sessions[0]["criteria"]
        ["players"]
        == 2
    )
    assert (
        analytics.sessions[0]["criteria"]
        ["mood_used"]
        is False
    )


def test_picker_requires_valid_player_count():
    class FakeGameService:
        def get_games(
            self,
        ):
            return []

    class FakePlayRepository:
        def get_players(
            self,
        ):
            return []

        def get_group_game_play_stats(
            self,
            player_ids,
        ):
            return {}

        def get_game_play_stats(
            self,
        ):
            return {}

    app.dependency_overrides[
        get_game_service
    ] = lambda: FakeGameService()

    app.dependency_overrides[
        get_picker_play_repository
    ] = lambda: FakePlayRepository()

    app.dependency_overrides[
        get_picker_analytics_repository
    ] = lambda: FakePickerAnalyticsRepository()

    try:
        response = client.get(
            "/picker",
            params={
                "players": 0,
            },
        )

    finally:
        app.dependency_overrides.clear()

    assert (
        response.status_code
        == 422
    )


def test_picker_event_is_recorded():
    analytics = (
        FakePickerAnalyticsRepository()
    )
    app.dependency_overrides[
        get_picker_analytics_repository
    ] = lambda: analytics

    try:
        response = client.post(
            "/picker/events",
            json={
                "session_id": (
                    "00000000-0000-0000-0000-000000000001"
                ),
                "event_type": "view_game",
                "bgg_id": 42,
                "position": 1,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 204
    assert analytics.events == [
        {
            "public_id": (
                "00000000-0000-0000-0000-000000000001"
            ),
            "event_type": "view_game",
            "bgg_id": 42,
            "position": 1,
        }
    ]


def test_picker_event_rejects_unknown_session():
    class MissingSessionRepository(
        FakePickerAnalyticsRepository
    ):
        def record_event(self, *args, **kwargs):
            return False

    app.dependency_overrides[
        get_picker_analytics_repository
    ] = lambda: MissingSessionRepository()

    try:
        response = client.post(
            "/picker/events",
            json={
                "session_id": (
                    "00000000-0000-0000-0000-000000000099"
                ),
                "event_type": "start_over",
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404


def test_record_play_returns_404_for_unknown_game():
    class FakePlayService:
        def record_play(
            self,
            bgg_id: int,
            played_at,
            duration_minutes:
                int | None,
            participants:
                list[dict],
            location=None,
            timer_session_id=None,
        ):
            return None

    app.dependency_overrides[
        get_play_service
    ] = lambda: FakePlayService()

    app.dependency_overrides[
        get_picker_analytics_repository
    ] = lambda: FakePickerAnalyticsRepository()

    try:
        response = client.post(
            "/plays",
            json={
                "bgg_id": 999999999,
                "played_at": (
                    "2026-08-28T20:00:00+00:00"
                ),
                "duration_minutes":
                    60,
                "participants": [
                    {
                        "name": "Tom",
                        "score": 10,
                        "is_winner": True,
                    },
                ],
            },
        )

    finally:
        app.dependency_overrides.clear()

    assert (
        response.status_code
        == 404
    )

    assert (
        response.json()["detail"]
        == "Game not found"
    )


def test_record_play_links_picker_conversion():
    class FakePlayService:
        def record_play(
            self,
            bgg_id: int,
            played_at,
            duration_minutes: int | None,
            participants: list[dict],
            location=None,
            timer_session_id=None,
        ):
            return Play(
                id=7,
                bgg_id=bgg_id,
                player_count=len(participants),
                played_at=played_at,
            )

    analytics = (
        FakePickerAnalyticsRepository()
    )
    app.dependency_overrides[
        get_play_service
    ] = lambda: FakePlayService()
    app.dependency_overrides[
        get_picker_analytics_repository
    ] = lambda: analytics

    try:
        response = client.post(
            "/plays",
            json={
                "bgg_id": 42,
                "played_at": (
                    "2026-09-16T20:00:00+00:00"
                ),
                "participants": [
                    {
                        "name": "Tom",
                        "is_winner": True,
                    }
                ],
                "picker_session_id": (
                    "00000000-0000-0000-0000-000000000001"
                ),
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 201
    assert analytics.events[0][
        "event_type"
    ] == "log_play"
    assert analytics.events[0]["bgg_id"] == 42


def test_live_timer_requires_pro_and_passes_draft_context():
    service = FakeLiveTimerService()
    app.dependency_overrides[get_live_timer_service] = lambda: service
    try:
        app.dependency_overrides[get_current_user] = lambda: User(id=1, email="free@example.com", tier="FREE")
        denied = client.post("/play-timer/start", json={"bgg_id": 13})
        assert denied.status_code == 403
        for method, path in (
            (client.get, "/play-timer"),
            (client.post, "/play-timer/pause"),
            (client.post, "/play-timer/resume"),
            (client.post, "/play-timer/finish"),
            (client.delete, "/play-timer"),
        ):
            assert method(path).status_code == 403

        app.dependency_overrides[get_current_user] = lambda: User(id=2, email="pro@example.com", tier="PRO")
        allowed = client.post(
            "/play-timer/start",
            json={"bgg_id": 13, "participant_names": ["Alex"], "location": "Club"},
        )
    finally:
        app.dependency_overrides.clear()

    assert allowed.status_code == 201
    assert service.started == [(13, ["Alex"], "Club")]


def test_picker_uses_preferred_mechanic():
    class FakeGameService:
        def get_games(
            self,
        ):
            return [
                Game(
                    bgg_id=1,
                    name="Deck Builder",
                    min_players=2,
                    max_players=4,
                    max_play_time=60,
                    complexity=2.5,
                    owned=True,
                    mechanics=[
                        "Deck Building"
                    ],
                ),
                Game(
                    bgg_id=2,
                    name=(
                        "Worker Placement "
                        "Game"
                    ),
                    min_players=2,
                    max_players=4,
                    max_play_time=60,
                    complexity=2.5,
                    owned=True,
                    mechanics=[
                        "Worker Placement"
                    ],
                ),
            ]

    class FakePlayRepository:
        def get_players(
            self,
        ):
            return []

        def get_group_game_play_stats(
            self,
            player_ids,
        ):
            return {}

        def get_game_play_stats(
            self,
        ):
            return {}

    app.dependency_overrides[
        get_game_service
    ] = lambda: FakeGameService()

    app.dependency_overrides[
        get_picker_play_repository
    ] = lambda: FakePlayRepository()

    app.dependency_overrides[
        get_picker_analytics_repository
    ] = lambda: FakePickerAnalyticsRepository()

    try:
        response = client.get(
            "/picker",
            params={
                "players": 2,
                "max_play_time": 60,
                "max_complexity": 3.0,
                "preferred_mechanics":
                    "Deck Building",
            },
        )

    finally:
        app.dependency_overrides.clear()

    assert (
        response.status_code
        == 200
    )

    data = response.json()

    assert len(data) == 2

    assert (
        data[0]["game"]["bgg_id"]
        == 1
    )

    assert (
        "Matches preferred mechanic: "
        "Deck Building"
        in data[0]["reasons"]
    )


def test_picker_filters_by_game_type_and_age():
    class FakeGameService:
        def get_games(self):
            return [
                Game(
                    bgg_id=1,
                    name="Family Co-op",
                    min_players=2,
                    max_players=4,
                    min_age=8,
                    owned=True,
                    mechanics=[
                        "Cooperative Game"
                    ],
                ),
                Game(
                    bgg_id=2,
                    name="Older Co-op",
                    min_players=2,
                    max_players=4,
                    min_age=14,
                    owned=True,
                    mechanics=[
                        "Cooperative Game"
                    ],
                ),
                Game(
                    bgg_id=3,
                    name="Competitive Game",
                    min_players=2,
                    max_players=4,
                    min_age=8,
                    owned=True,
                    mechanics=["Auction / Bidding"],
                ),
            ]

    class FakePlayRepository:
        def get_players(self):
            return []

        def get_group_game_play_stats(
            self,
            player_ids,
        ):
            return {}

        def get_game_play_stats(self):
            return {}

    app.dependency_overrides[
        get_game_service
    ] = lambda: FakeGameService()
    app.dependency_overrides[
        get_picker_play_repository
    ] = lambda: FakePlayRepository()

    app.dependency_overrides[
        get_picker_analytics_repository
    ] = lambda: FakePickerAnalyticsRepository()

    try:
        response = client.get(
            "/picker",
            params={
                "players": 2,
                "play_style": "cooperative",
                "youngest_player_age": 10,
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert [
        item["game"]["bgg_id"]
        for item in response.json()
    ] == [1]

def test_get_player_stats():
    class FakePlayRepository:
        def get_player_stats(
            self,
            player_id: int,
        ):
            assert player_id == 7

            return {
                "player": {
                    "id": 7,
                    "name": "Alex",
                },
                "total_plays": 12,
                "unique_games": 6,
                "wins": 4,
                "win_rate": 33.3,
                "most_played_games": [
                    {
                        "bgg_id": 1,
                        "name": "Dune",
                        "play_count": 3,
                        "last_played_at": (
                            datetime(
                                2026,
                                9,
                                1,
                                20,
                                0,
                                tzinfo=timezone.utc,
                            )
                        ),
                    },
                ],
                "recent_games": [
                    {
                        "play_id": 10,
                        "bgg_id": 1,
                        "name": "Dune",
                        "played_at": (
                            datetime(
                                2026,
                                9,
                                1,
                                20,
                                0,
                                tzinfo=timezone.utc,
                            )
                        ),
                        "is_winner": True,
                        "score": 85,
                    },
                ],
                "common_partners": [
                    {
                        "id": 2,
                        "name": "Tom",
                        "play_count": 8,
                    },
                ],
            }

    app.dependency_overrides[
        get_play_repository
    ] = lambda: FakePlayRepository()

    try:
        response = client.get(
            "/players/7/stats"
        )

    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200

    data = response.json()

    assert data["player"] == {
        "id": 7,
        "name": "Alex",
    }

    assert data["total_plays"] == 12
    assert data["unique_games"] == 6
    assert data["wins"] == 4
    assert data["win_rate"] == 33.3

    assert (
        data["most_played_games"][0][
            "name"
        ]
        == "Dune"
    )

    assert (
        data["recent_games"][0][
            "is_winner"
        ]
        is True
    )

    assert (
        data["common_partners"][0][
            "name"
        ]
        == "Tom"
    )


def test_get_unknown_player_stats_returns_404():
    class FakePlayRepository:
        def get_player_stats(
            self,
            player_id: int,
        ):
            return None

    app.dependency_overrides[
        get_play_repository
    ] = lambda: FakePlayRepository()

    try:
        response = client.get(
            "/players/999999/stats"
        )

    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 404

    assert response.json() == {
        "detail": "Player not found"
    }
