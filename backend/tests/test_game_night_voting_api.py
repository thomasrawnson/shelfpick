from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from api.current_user import get_current_user
from api.dependencies import get_game_service
from api.main import app
from auth.login_rate_limiter import game_night_join_rate_limiter
from database.connection import Base, get_db
from database.models import Game, User, UserGame


@pytest.fixture()
def voting_api():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)
    session = Session()
    session.add_all([
        User(id=1, email="host@example.com", tier="PRO"),
        User(id=2, email="other@example.com", tier="PRO"),
    ])
    games = [
        Game(bgg_id=index, name=f"Game {index}", owned=True)
        for index in range(1, 4)
    ]
    session.add_all(games)
    session.flush()
    session.add_all([UserGame(user_id=1, game_id=game.id) for game in games])
    session.commit()

    current_user = {"value": SimpleNamespace(id=1, tier="PRO")}

    class FakeGameService:
        def get_games(self):
            return games

    def override_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: current_user["value"]
    app.dependency_overrides[get_game_service] = lambda: FakeGameService()
    game_night_join_rate_limiter.clear()
    try:
        with TestClient(app) as client:
            yield client, current_user
    finally:
        app.dependency_overrides.clear()
        game_night_join_rate_limiter.clear()
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_host_and_guest_complete_persisted_voting_flow(voting_api):
    client, _ = voting_api
    opened = client.post(
        "/game-night/voting",
        json={"candidate_bgg_ids": [1, 2, 3]},
    )
    assert opened.status_code == 201
    opened_data = opened.json()
    join_token = opened_data["join_url"].rsplit("/", 1)[-1]

    joined = client.post(
        f"/game-night/voting/{join_token}/join",
        json={"display_name": "Morgan"},
    )
    assert joined.status_code == 200
    credential = joined.json()["guest_credential"]
    headers = {"X-Game-Night-Guest": credential}

    first = client.put(
        f"/game-night/voting/{join_token}/ballot",
        json={"candidate_bgg_id": 1},
        headers=headers,
    )
    changed = client.put(
        f"/game-night/voting/{join_token}/ballot",
        json={"candidate_bgg_id": 2},
        headers=headers,
    )
    restored = client.get(
        f"/game-night/voting/{join_token}", headers=headers,
    )

    assert first.status_code == 200
    assert changed.json()["ballots_submitted"] == 1
    assert restored.json()["guest"]["current_vote"] == 2

    closed = client.post(
        f"/game-night/voting/sessions/{opened_data['session_id']}/close"
    )
    rejected = client.put(
        f"/game-night/voting/{join_token}/ballot",
        json={"candidate_bgg_id": 3},
        headers=headers,
    )

    assert closed.status_code == 200
    assert closed.json()["results"]["winner_bgg_ids"] == [2]
    assert rejected.status_code == 409
    assert rejected.json()["detail"] == "Voting is closed."


def test_host_ownership_and_join_tokens_do_not_cross_sessions(voting_api):
    client, current_user = voting_api
    first = client.post(
        "/game-night/voting", json={"candidate_bgg_ids": [1, 2, 3]},
    ).json()
    second = client.post(
        "/game-night/voting", json={"candidate_bgg_ids": [1, 2, 3]},
    ).json()
    first_token = first["join_url"].rsplit("/", 1)[-1]
    second_token = second["join_url"].rsplit("/", 1)[-1]
    joined = client.post(
        f"/game-night/voting/{first_token}/join",
        json={"display_name": "Morgan"},
    ).json()

    wrong_session = client.get(
        f"/game-night/voting/{second_token}",
        headers={"X-Game-Night-Guest": joined["guest_credential"]},
    )
    current_user["value"] = SimpleNamespace(id=2, tier="PRO")
    wrong_owner = client.get(
        f"/game-night/voting/sessions/{first['session_id']}"
    )

    assert wrong_session.status_code == 200
    assert wrong_session.json()["guest"] is None
    assert wrong_owner.status_code == 404
