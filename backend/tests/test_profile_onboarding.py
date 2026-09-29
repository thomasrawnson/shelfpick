from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from api.main import app
from auth.security import create_access_token
from database.connection import Base, get_db
from database.models import Game, Play, PlayParticipant, Player, User
from repositories.play_repository import PlayRepository


@pytest.fixture
def account():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool,
    )
    session_factory = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)
    with session_factory() as db:
        user = User(email="profile@example.com", display_name="Morgan")
        db.add(user)
        db.commit()
        db.refresh(user)
        user_id = user.id

    def override_db():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    try:
        with TestClient(app) as client:
            yield client, session_factory, user_id, {
                "Authorization": f"Bearer {create_access_token(user_id)}",
            }
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_onboarding_persists_profile_preferences_and_player(account):
    client, sessions, user_id, headers = account
    assert client.get("/auth/me", headers=headers).json()["onboarding_completed"] is False

    response = client.post("/auth/onboarding/complete", headers=headers, json={
        "player_name": "Morgan Reed", "avatar_key": "gold",
        "preferred_player_count": 3, "preferred_play_time": 90,
        "preferred_play_style": "cooperative",
    })
    assert response.status_code == 200
    profile = response.json()
    assert profile["onboarding_completed"] is True
    assert profile["player_name"] == "Morgan Reed"
    assert profile["avatar_key"] == "gold"
    assert profile["preferred_player_count"] == 3
    assert profile["preferred_play_time"] == 90
    assert profile["preferred_play_style"] == "cooperative"
    assert profile["profile_player_id"] is not None
    assert client.get("/auth/me", headers=headers).json()["profile_player_id"] == profile["profile_player_id"]
    players = client.get("/players", headers=headers).json()
    assert any(player["id"] == profile["profile_player_id"] and player["avatar_key"] == "gold" for player in players)
    with sessions() as db:
        assert PlayRepository(db, user_id).get_discover_profile() == {
            "typical_player_count": 3, "typical_play_time": 90,
            "player_count_source": "preference", "play_time_source": "preference",
        }


def test_skipped_preferences_and_partial_completion_are_safe(account):
    client, _, _, headers = account
    response = client.post("/auth/onboarding/complete", headers=headers, json={})
    assert response.status_code == 200
    assert response.json()["onboarding_completed"] is True
    assert response.json()["player_name"] == "Morgan"
    assert response.json()["preferred_player_count"] is None
    assert response.json()["preferred_play_time"] is None
    assert response.json()["preferred_play_style"] is None
    assert response.json()["bgg_username"] is None
    assert client.post("/auth/onboarding/complete", headers=headers, json={}).json()["profile_player_id"] == response.json()["profile_player_id"]


def test_profile_update_changes_identity_and_clears_defaults(account):
    client, _, _, headers = account
    client.post("/auth/onboarding/complete", headers=headers, json={
        "player_name": "Morgan", "preferred_player_count": 2,
    })
    response = client.put("/auth/profile", headers=headers, json={
        "player_name": "Morgan R", "avatar_key": "clay",
        "preferred_player_count": None, "preferred_play_time": 0,
        "preferred_play_style": "competitive",
    })
    assert response.status_code == 200
    assert response.json()["player_name"] == "Morgan R"
    assert response.json()["avatar_key"] == "clay"
    assert response.json()["preferred_player_count"] is None
    assert response.json()["preferred_play_time"] == 0
    assert response.json()["preferred_play_style"] == "competitive"
    assert client.get("/auth/me", headers=headers).json()["player_name"] == "Morgan R"


def test_profile_update_accepts_new_avatar_without_changing_other_fields(account):
    client, _, _, headers = account
    original = client.post("/auth/onboarding/complete", headers=headers, json={
        "player_name": "Morgan", "avatar_key": "gold",
        "preferred_player_count": 4, "preferred_play_time": 90,
        "preferred_play_style": "cooperative",
    }).json()

    response = client.put("/auth/profile", headers=headers, json={"avatar_key": "dice"})

    assert response.status_code == 200
    profile = response.json()
    assert profile["avatar_key"] == "dice"
    assert profile["player_name"] == original["player_name"]
    assert profile["preferred_player_count"] == original["preferred_player_count"]
    assert profile["preferred_play_time"] == original["preferred_play_time"]
    assert profile["preferred_play_style"] == original["preferred_play_style"]
    assert client.get("/auth/me", headers=headers).json()["avatar_key"] == "dice"
    players = client.get("/players", headers=headers).json()
    assert any(
        player["id"] == profile["profile_player_id"] and player["avatar_key"] == "dice"
        for player in players
    )


def test_players_are_ordered_by_latest_play_date_then_name_and_scoped(account):
    client, sessions, user_id, headers = account

    with sessions() as db:
        other_user = User(email="other-players@example.com", display_name="Other")
        game = Game(bgg_id=999301, name="Player Ordering Test", owned=True)
        db.add_all([other_user, game])
        db.flush()

        players = {
            name: Player(user_id=user_id, name=name, normalized_name=name.lower())
            for name in ("Alex", "Blair", "Casey", "Zoe")
        }
        other_player = Player(
            user_id=other_user.id,
            name="Other Account Player",
            normalized_name="other account player",
        )
        db.add_all([*players.values(), other_player])
        db.flush()

        older_play = Play(
            user_id=user_id,
            game_id=game.id,
            player_count=1,
            played_at=datetime(2026, 8, 20, tzinfo=timezone.utc),
            source="app",
        )
        newer_play = Play(
            user_id=user_id,
            game_id=game.id,
            player_count=1,
            played_at=datetime(2026, 9, 10, tzinfo=timezone.utc),
            source="app",
        )
        other_play = Play(
            user_id=other_user.id,
            game_id=game.id,
            player_count=1,
            played_at=datetime(2026, 9, 29, tzinfo=timezone.utc),
            source="app",
        )
        db.add_all([newer_play, older_play, other_play])
        db.flush()
        db.add_all([
            PlayParticipant(
                play_id=older_play.id,
                player_id=players["Alex"].id,
                name="Alex",
            ),
            PlayParticipant(
                play_id=newer_play.id,
                player_id=players["Zoe"].id,
                name="Zoe",
            ),
            PlayParticipant(
                play_id=other_play.id,
                player_id=other_player.id,
                name="Other Account Player",
            ),
        ])
        db.commit()

    response = client.get("/players", headers=headers)

    assert response.status_code == 200
    assert [player["name"] for player in response.json()] == [
        "Zoe",
        "Alex",
        "Blair",
        "Casey",
    ]


def test_preference_only_update_preserves_identity_and_rejects_invalid_style(account):
    client, _, _, headers = account
    client.post("/auth/onboarding/complete", headers=headers, json={
        "player_name": "Morgan", "avatar_key": "gold",
    })

    response = client.put("/auth/profile", headers=headers, json={
        "preferred_player_count": 5,
        "preferred_play_time": 120,
        "preferred_play_style": "cooperative",
    })
    assert response.status_code == 200
    profile = response.json()
    assert profile["player_name"] == "Morgan"
    assert profile["avatar_key"] == "gold"
    assert profile["preferred_player_count"] == 5
    assert profile["preferred_play_time"] == 120
    assert profile["preferred_play_style"] == "cooperative"
    assert client.get("/auth/me", headers=headers).json()["preferred_play_style"] == "cooperative"

    invalid = client.put("/auth/profile", headers=headers, json={
        "preferred_play_style": "sometimes",
    })
    assert invalid.status_code == 422
    assert client.get("/auth/me", headers=headers).json()["preferred_play_style"] == "cooperative"


def test_existing_participant_is_not_silently_linked(account):
    client, sessions, user_id, headers = account
    with sessions() as db:
        db.add(Player(user_id=user_id, name="Morgan", normalized_name="morgan"))
        db.commit()
    response = client.post("/auth/onboarding/complete", headers=headers, json={
        "player_name": "Morgan",
    })
    assert response.status_code == 409
    assert client.get("/auth/me", headers=headers).json()["onboarding_completed"] is False
