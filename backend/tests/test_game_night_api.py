from types import SimpleNamespace

from fastapi.testclient import TestClient

from api.current_user import get_current_user
from api.dependencies import get_game_service, get_play_repository
from api.main import app
from models.game import Game, PlayerCountPoll


client = TestClient(app)


class FakeGameService:
    def get_games(self):
        games = [
            Game(
                bgg_id=index,
                name=f"Game {index}",
                min_players=3,
                max_players=5,
                max_play_time=60,
                owned=True,
            )
            for index in range(1, 7)
        ]
        games.append(
            Game(
                bgg_id=99,
                name="Rejected at three",
                min_players=3,
                max_players=5,
                max_play_time=60,
                owned=True,
                player_count_poll=[PlayerCountPoll(3, 0, 7, 3, 10)],
            )
        )
        return games


class FakePlayRepository:
    def get_players(self):
        return [{"id": 10}, {"id": 20}, {"id": 30}]

    def get_game_play_stats(self):
        return {}

    def get_group_game_play_stats(self, player_ids):
        assert player_ids == [10, 20, 30]
        return {}


def test_game_night_endpoint_uses_entitlement_and_picker_rules():
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(tier="FREE")
    app.dependency_overrides[get_game_service] = lambda: FakeGameService()
    app.dependency_overrides[get_play_repository] = lambda: FakePlayRepository()

    try:
        response = client.get(
            "/game-night/recommendations",
            params=[
                ("player_ids", "10"),
                ("player_ids", "20"),
                ("player_ids", "30"),
                ("max_play_time", "60"),
            ],
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5
    assert all(item["game"]["bgg_id"] != 99 for item in data)
    assert all("From your collection" in item["reasons"] for item in data)
