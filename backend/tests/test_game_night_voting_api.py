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
from services.game_night_voting_service import GameNightVotingService


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


def test_guest_rights_are_scoped_and_remove_own_ballot_only(voting_api):
    client, current_user = voting_api
    opened = client.post("/game-night/voting", json={"candidate_bgg_ids": [1, 2, 3]}).json()
    token = opened["join_url"].rsplit("/", 1)[-1]
    second_session = client.post("/game-night/voting", json={"candidate_bgg_ids": [1, 2, 3]}).json()
    other_token = second_session["join_url"].rsplit("/", 1)[-1]
    first = client.post(f"/game-night/voting/{token}/join", json={"display_name": "First"}).json()["guest_credential"]
    second = client.post(f"/game-night/voting/{token}/join", json={"display_name": "Second"}).json()["guest_credential"]
    first_headers = {"X-Game-Night-Guest": first}
    second_headers = {"X-Game-Night-Guest": second}
    for credential, game in ((first, 1), (second, 2)):
        assert client.put(
            f"/game-night/voting/{token}/ballot",
            json={"candidate_bgg_id": game},
            headers={"X-Game-Night-Guest": credential},
        ).status_code == 200

    assert client.put(f"/game-night/voting/{token}/guest", json={"display_name": "Wrong"}).status_code == 404
    assert client.delete(f"/game-night/voting/{token}/guest").status_code == 404
    assert client.delete(
        f"/game-night/voting/{token}/guest",
        headers={"X-Game-Night-Guest": "invalid"},
    ).status_code == 404
    assert client.delete(
        f"/game-night/voting/{other_token}/guest", headers=first_headers,
    ).status_code == 404
    assert client.put(
        f"/game-night/voting/{token}/guest", json={"display_name": "Alias"}, headers=first_headers,
    ).status_code == 200
    assert client.get(f"/game-night/voting/{token}", headers=first_headers).json()["guest"]["display_name"] == "Alias"
    assert client.post(f"/game-night/voting/sessions/{opened['session_id']}/close").status_code == 200
    assert client.delete(f"/game-night/voting/{token}/guest", headers=first_headers).status_code == 200
    assert client.delete(f"/game-night/voting/{token}/guest", headers=first_headers).status_code == 404
    other_state = client.get(f"/game-night/voting/{token}", headers=second_headers).json()
    assert other_state["participant_count"] == other_state["ballots_submitted"] == 1
    assert other_state["guest"]["current_vote"] == 2
    assert "participant_names" not in other_state
    host_state = client.get(f"/game-night/voting/sessions/{opened['session_id']}").json()
    assert host_state["participant_names"] == ["Second"]
    current_user["value"] = SimpleNamespace(id=2, tier="PRO")
    assert client.get(f"/game-night/voting/sessions/{opened['session_id']}").status_code == 404


def test_guest_rights_survive_link_expiry(voting_api, monkeypatch):
    client, _ = voting_api
    opened = client.post("/game-night/voting", json={"candidate_bgg_ids": [1, 2, 3]}).json()
    token = opened["join_url"].rsplit("/", 1)[-1]
    credential = client.post(f"/game-night/voting/{token}/join", json={"display_name": "Guest"}).json()["guest_credential"]
    headers = {"X-Game-Night-Guest": credential}
    monkeypatch.setattr(GameNightVotingService, "_is_expired", staticmethod(lambda _session: True))
    assert client.get(f"/game-night/voting/{token}", headers=headers).status_code == 410
    assert client.put(
        f"/game-night/voting/{token}/guest", json={"display_name": "New nickname"}, headers=headers,
    ).status_code == 200
    assert client.delete(f"/game-night/voting/{token}/guest", headers=headers).status_code == 200


def test_guest_rights_requests_are_throttled_without_logging_credentials(voting_api, caplog):
    client, _ = voting_api
    opened = client.post("/game-night/voting", json={"candidate_bgg_ids": [1, 2, 3]}).json()
    token = opened["join_url"].rsplit("/", 1)[-1]
    invalid = "synthetic-invalid-credential"
    for _ in range(20):
        assert client.delete(
            f"/game-night/voting/{token}/guest", headers={"X-Game-Night-Guest": invalid},
        ).status_code == 404
    limited = client.delete(
        f"/game-night/voting/{token}/guest", headers={"X-Game-Night-Guest": invalid},
    )
    assert limited.status_code == 429
    assert limited.headers["Retry-After"] == "900"
    assert invalid not in caplog.text
