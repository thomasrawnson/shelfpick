from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from api.current_user import get_current_user
from api.main import app
from database.connection import Base, get_db
from database.models import Player, User


@pytest.fixture()
def players_api():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)
    session = Session()
    session.add_all([
        User(id=1, email="host@example.com", tier="FREE"),
        User(id=2, email="other@example.com", tier="FREE"),
    ])
    session.commit()

    current_user = {"value": SimpleNamespace(id=1, tier="FREE")}

    def override_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: current_user["value"]
    try:
        with TestClient(app) as client:
            yield client, current_user, Session
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_create_player_appears_in_player_list(players_api):
    client, _, _ = players_api
    created = client.post("/players", json={"name": "  Alex   Reed "})
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Alex Reed"
    assert body["avatar_key"] in {"forest", "gold", "clay", "dice", "meeple", "cards"}

    listed = client.get("/players").json()
    assert [player["name"] for player in listed] == ["Alex Reed"]


def test_creating_the_same_name_returns_the_existing_player(players_api):
    client, _, Session = players_api
    first = client.post("/players", json={"name": "Alex"}).json()
    again = client.post("/players", json={"name": " alex "}).json()
    assert again["id"] == first["id"]
    with Session() as db:
        assert db.query(Player).count() == 1


def test_players_are_private_to_each_user(players_api):
    client, current_user, _ = players_api
    client.post("/players", json={"name": "Alex"})

    current_user["value"] = SimpleNamespace(id=2, tier="FREE")
    assert client.get("/players").json() == []
    other = client.post("/players", json={"name": "Alex"})
    assert other.status_code == 201

    current_user["value"] = SimpleNamespace(id=1, tier="FREE")
    assert len(client.get("/players").json()) == 1


@pytest.mark.parametrize("name", ["", "   ", "x" * 101])
def test_invalid_names_are_rejected(players_api, name):
    client, _, _ = players_api
    assert client.post("/players", json={"name": name}).status_code == 422


def test_new_player_colour_is_stable_for_a_name(players_api):
    client, _, _ = players_api
    first = client.post("/players", json={"name": "Sam"}).json()["avatar_key"]
    again = client.post("/players", json={"name": " SAM "}).json()["avatar_key"]
    assert first == again
