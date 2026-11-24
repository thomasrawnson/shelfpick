"""POST /plays with a client_id is idempotent per user (SP-NATIVE-01c)."""

from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from api.current_user import get_current_user
from api.main import app
from database.connection import Base, get_db
from database.models import Game, Play, PlayParticipant, User, UserGame


@pytest.fixture()
def api():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)
    with Session() as db:
        db.add_all([
            User(id=1, email="a@example.com", tier="FREE"),
            User(id=2, email="b@example.com", tier="FREE"),
            Game(id=1, bgg_id=100, name="Game One", owned=True),
        ])
        db.flush()
        db.add_all([UserGame(user_id=1, game_id=1), UserGame(user_id=2, game_id=1)])
        db.commit()
    current = {"value": SimpleNamespace(id=1, tier="FREE")}

    def override_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: current["value"]
    try:
        with TestClient(app) as client:
            yield client, current, Session
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()


def body(**overrides):
    return {
        "bgg_id": 100,
        "played_at": "2026-11-01T19:00:00Z",
        "duration_minutes": 60,
        "location": "Home",
        "participants": [
            {"name": "Alex", "score": 10, "is_winner": True},
            {"name": "Sam", "score": 5},
        ],
        **overrides,
    }


def play_count(Session, **filters):
    with Session() as db:
        return db.scalar(select(func.count()).select_from(Play).filter_by(**filters))


def test_a_repeated_client_id_returns_the_same_play_and_creates_nothing(api):
    client, _, Session = api
    client_id = str(uuid4())

    first = client.post("/plays", json=body(client_id=client_id))
    repeat = client.post("/plays", json=body(client_id=client_id))

    assert first.status_code == 201
    assert repeat.status_code == 200
    assert repeat.json() == first.json()
    assert set(first.json()) == {"id", "bgg_id", "player_count", "played_at", "duration_minutes", "location"}
    assert play_count(Session) == 1
    with Session() as db:
        assert db.scalar(select(func.count()).select_from(PlayParticipant)) == 2


def test_a_repeat_ignores_a_changed_body(api):
    client, _, Session = api
    client_id = str(uuid4())
    first = client.post("/plays", json=body(client_id=client_id)).json()

    repeat = client.post("/plays", json=body(
        client_id=client_id, location="Elsewhere",
        participants=[{"name": "Kim", "score": 1}],
    ))

    assert repeat.status_code == 200
    assert repeat.json()["id"] == first["id"]
    assert repeat.json()["location"] == "Home"
    assert play_count(Session) == 1


def test_client_ids_are_per_user(api):
    client, current, Session = api
    client_id = str(uuid4())

    mine = client.post("/plays", json=body(client_id=client_id))
    current["value"] = SimpleNamespace(id=2, tier="FREE")
    theirs = client.post("/plays", json=body(client_id=client_id))

    assert mine.status_code == 201 and theirs.status_code == 201
    assert mine.json()["id"] != theirs.json()["id"]
    assert play_count(Session, user_id=1) == 1 and play_count(Session, user_id=2) == 1


def test_one_client_id_cannot_return_another_users_play(api):
    client, current, _ = api
    client_id = str(uuid4())
    other = client.post("/plays", json=body(client_id=client_id)).json()

    current["value"] = SimpleNamespace(id=2, tier="FREE")
    mine = client.post("/plays", json=body(client_id=client_id, location="Mine"))

    assert mine.status_code == 201
    assert mine.json()["id"] != other["id"]
    assert mine.json()["location"] == "Mine"


def test_plays_without_a_client_id_are_never_merged(api):
    client, _, Session = api
    assert client.post("/plays", json=body()).status_code == 201
    assert client.post("/plays", json=body()).status_code == 201
    assert client.post("/plays", json=body(client_id=None)).status_code == 201
    assert play_count(Session) == 3


def test_the_id_is_stored_canonically_and_must_be_a_uuid(api):
    client, _, Session = api
    client_id = str(uuid4())
    assert client.post("/plays", json=body(client_id=client_id.upper())).status_code == 201
    assert client.post("/plays", json=body(client_id=client_id)).status_code == 200
    with Session() as db:
        assert db.scalar(select(Play.client_id)) == client_id

    bad = client.post("/plays", json=body(client_id="x" * 36))
    assert bad.status_code == 422
    assert client.post("/plays", json=body(client_id="short")).status_code == 422
    assert play_count(Session) == 1


def test_a_repeat_for_a_game_no_longer_on_the_shelf_still_returns_the_play(api):
    client, _, Session = api
    client_id = str(uuid4())
    first = client.post("/plays", json=body(client_id=client_id)).json()
    with Session() as db:
        db.query(UserGame).filter_by(user_id=1, game_id=1).delete()
        db.commit()

    repeat = client.post("/plays", json=body(client_id=client_id))

    assert repeat.status_code == 200 and repeat.json()["id"] == first["id"]


def test_a_validation_error_creates_nothing_and_can_be_retried_with_the_same_id(api):
    client, _, Session = api
    client_id = str(uuid4())
    bad = client.post("/plays", json=body(
        client_id=client_id,
        participants=[{"name": "Alex"}, {"name": "alex"}],
    ))
    assert bad.status_code == 400 and play_count(Session) == 0

    good = client.post("/plays", json=body(client_id=client_id))
    assert good.status_code == 201 and play_count(Session) == 1


def test_the_database_refuses_a_duplicate_pair_even_if_the_check_is_raced(api):
    _, _, Session = api
    client_id = str(uuid4())
    with Session() as db:
        db.add(Play(user_id=1, game_id=1, player_count=1, client_id=client_id))
        db.commit()
        db.add(Play(user_id=1, game_id=1, player_count=1, client_id=client_id))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
        # A different user, and a missing id, are both allowed.
        db.add_all([
            Play(user_id=2, game_id=1, player_count=1, client_id=client_id),
            Play(user_id=1, game_id=1, player_count=1),
            Play(user_id=1, game_id=1, player_count=1),
        ])
        db.commit()


def test_a_raced_duplicate_is_resolved_by_the_unique_constraint(api, monkeypatch):
    """Both requests passed the existing-play check; the second one fails at flush and returns the first."""
    from repositories.play_write_repository import PlayWriteRepository

    client, _, Session = api
    client_id = str(uuid4())
    first = client.post("/plays", json=body(client_id=client_id)).json()

    real = PlayWriteRepository._play_by_client_id
    calls = {"n": 0}

    def blind_the_first_check(self, value):
        calls["n"] += 1
        return None if calls["n"] == 1 else real(self, value)

    monkeypatch.setattr(PlayWriteRepository, "_play_by_client_id", blind_the_first_check)
    repeat = client.post("/plays", json=body(client_id=client_id))

    assert calls["n"] == 2
    assert repeat.status_code == 200 and repeat.json()["id"] == first["id"]
    assert play_count(Session) == 1
