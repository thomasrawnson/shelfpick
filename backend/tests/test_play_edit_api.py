import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from api.current_user import get_current_user
from api.dependencies import get_play_repository  # noqa: F401
from api.main import app
from database.connection import Base, get_db
from database.models import Game, Mechanic, Play, PlayParticipant, User, UserGame
from repositories.play_repository import PlayRepository
from services.bgstats_play_import_service import BGStatsPlayImportService


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
            Game(id=2, bgg_id=200, name="Game Two", owned=True),
        ])
        db.flush()
        db.add_all([
            UserGame(user_id=1, game_id=1),
            UserGame(user_id=2, game_id=1),
        ])
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


def log(client, **overrides):
    body = {
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
    response = client.post("/plays", json=body)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_edit_every_field(api):
    client, _, Session = api
    with Session() as db:
        db.add(UserGame(user_id=1, game_id=2))
        db.commit()
    play_id = log(client)
    response = client.patch(f"/plays/{play_id}", json={
        "bgg_id": 200,
        "played_at": "2026-11-02T20:30:00Z",
        "duration_minutes": 90,
        "location": "  The   Cafe ",
        "outcome_type": "team",
        "participants": [
            {"name": "Alex", "score": 3, "team": "Red", "role": "Spy", "rank": 1},
            {"name": "Jo", "team": "red", "rank": 1},
            {"name": "Sam", "team": "Blue", "rank": 2},
        ],
    })
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["bgg_id"] == 200
    assert body["duration_minutes"] == 90
    assert body["location"] == "The Cafe"
    assert body["player_count"] == 3
    assert body["outcome_type"] == "team"
    by_name = {p["name"]: p for p in body["participants"]}
    assert by_name["Alex"]["role"] == "Spy"
    assert by_name["Alex"]["outcome"] == "win"
    assert by_name["Jo"]["team"] == "Red"
    assert by_name["Jo"]["outcome"] == "win"
    assert by_name["Sam"]["outcome"] == "loss"

    # Clearing optional fields works with explicit nulls.
    cleared = client.patch(f"/plays/{play_id}", json={
        "duration_minutes": None, "location": None,
    }).json()
    assert cleared["duration_minutes"] is None
    assert cleared["location"] is None
    assert cleared["outcome_type"] == "team"


def test_edit_to_cooperative_result(api):
    client, _, _ = api
    play_id = log(client)
    response = client.patch(f"/plays/{play_id}", json={
        "outcome_type": "cooperative",
        "coop_result": "lost",
        "participants": [{"name": "Alex"}, {"name": "Sam"}],
    })
    assert response.status_code == 200, response.text
    assert [p["outcome"] for p in response.json()["participants"]] == ["loss", "loss"]


def test_edit_of_another_users_play_is_refused(api):
    client, current, Session = api
    play_id = log(client)
    current["value"] = SimpleNamespace(id=2, tier="FREE")
    response = client.patch(f"/plays/{play_id}", json={"location": "Mine now"})
    assert response.status_code == 404
    with Session() as db:
        assert db.get(Play, play_id).location == "Home"
    assert client.patch("/plays/9999", json={}).status_code == 404


def test_edit_to_game_outside_collection_is_rejected(api):
    client, _, _ = api
    play_id = log(client)
    response = client.patch(f"/plays/{play_id}", json={"bgg_id": 200})
    assert response.status_code == 400


@pytest.mark.parametrize("patch", [
    {"outcome_type": "cooperative", "participants": [{"name": "A"}, {"name": "B"}]},
    {"outcome_type": "cooperative", "coop_result": "won",
     "participants": [{"name": "A", "is_winner": True}]},
    {"outcome_type": "team", "participants": [
        {"name": "A", "team": "Red"}, {"name": "B", "team": "Red"}]},
    {"outcome_type": "team", "participants": [
        {"name": "A", "team": "Red"}, {"name": "B"}]},
    {"participants": [{"name": "A", "rank": 1}, {"name": "B"}]},
    {"participants": [{"name": "A"}, {"name": "a "}]},
    {"coop_result": "won"},
    {"played_at": None},
    {"participants": None},
])
def test_invalid_edits_return_400(api, patch):
    client, _, _ = api
    play_id = log(client)
    assert client.patch(f"/plays/{play_id}", json=patch).status_code == 400


@pytest.mark.parametrize("patch", [
    {"participants": [{"name": "A", "rank": 0}]},
    {"participants": []},
    {"outcome_type": "bogus"},
])
def test_malformed_edits_return_422(api, patch):
    client, _, _ = api
    play_id = log(client)
    assert client.patch(f"/plays/{play_id}", json=patch).status_code == 422


def test_log_coop_and_team_plays(api):
    client, _, Session = api
    coop = log(client, outcome_type="cooperative", coop_result="won",
               participants=[{"name": "Alex"}, {"name": "Sam"}])
    team = log(client, outcome_type="team", participants=[
        {"name": "Alex", "team": "Red", "is_winner": True},
        {"name": "Sam", "team": "Blue"},
    ])
    with Session() as db:
        assert db.get(Play, coop).coop_result == "won"
        assert all(p.is_winner for p in db.get(Play, coop).participants)
        assert {p.name: p.is_winner for p in db.get(Play, team).participants} == {
            "Alex": True, "Sam": False,
        }
    bad = client.post("/plays", json={
        "bgg_id": 100, "outcome_type": "cooperative",
        "participants": [{"name": "Alex"}],
    })
    assert bad.status_code == 400


def export(plays, cooperative=False):
    return json.dumps({
        "games": [{"id": 1, "bggId": 100, "cooperative": cooperative}],
        "players": [{"id": 1, "name": "Tom"}, {"id": 2, "name": "Eve"}],
        "plays": plays,
    })


def import_text(Session, text):
    with Session() as db:
        service = BGStatsPlayImportService(PlayRepository(db, 1))
        return service.import_plays(text)


def test_bgstats_import_maps_rank_team_role_and_coop(api):
    _, _, Session = api
    plays = [
        {"uuid": "rank", "playDate": "2026-11-01T10:00:00Z", "gameRefId": 1,
         "playerScores": [
             {"playerRefId": 1, "rank": 1, "winner": True, "role": "Mage"},
             {"playerRefId": 2, "rank": 2}]},
        {"uuid": "team", "playDate": "2026-11-02T10:00:00Z", "gameRefId": 1,
         "usesTeams": True,
         "playerScores": [
             {"playerRefId": 1, "team": "Red", "winner": True},
             {"playerRefId": 2, "team": "Blue"}]},
        {"uuid": "partial", "playDate": "2026-11-03T10:00:00Z", "gameRefId": 1,
         "playerScores": [
             {"playerRefId": 1, "rank": 1, "winner": True},
             {"playerRefId": 2}]},
    ]
    result = import_text(Session, export(plays))
    assert result.imported == 3
    with Session() as db:
        rows = {p.source_play_id: p for p in db.query(Play).all()}
        rank = {x.name: x for x in rows["rank"].participants}
        assert (rank["Tom"].rank, rank["Tom"].role, rank["Eve"].rank) == (1, "Mage", 2)
        assert rows["team"].outcome_type == "team"
        assert {x.name: x.team for x in rows["team"].participants} == {"Tom": "Red", "Eve": "Blue"}
        # Partial ranks are not accepted; the play keeps its winner flags.
        assert rows["partial"].outcome_type == "competitive"
        assert all(x.rank is None for x in rows["partial"].participants)
        assert {x.name: x.is_winner for x in rows["partial"].participants}["Tom"] is True

    coop = [{"uuid": "coop", "playDate": "2026-11-04T10:00:00Z", "gameRefId": 1,
             "playerScores": [{"playerRefId": 1, "winner": True},
                              {"playerRefId": 2, "winner": True}]},
            {"uuid": "coop-lost", "playDate": "2026-11-05T10:00:00Z", "gameRefId": 1,
             "playerScores": [{"playerRefId": 1}, {"playerRefId": 2}]}]
    import_text(Session, export(coop, cooperative=True))
    with Session() as db:
        rows = {p.source_play_id: p for p in db.query(Play).all()}
        assert (rows["coop"].outcome_type, rows["coop"].coop_result) == ("cooperative", "won")
        assert rows["coop-lost"].coop_result == "lost"


def test_old_format_export_still_imports(api):
    _, _, Session = api
    old = json.dumps({
        "games": [{"id": 1, "bggId": 100}],
        "players": [{"id": 1, "name": "Tom"}],
        "plays": [{"uuid": "old", "playDate": "2026-11-01T10:00:00Z",
                   "gameRefId": 1,
                   "playerScores": [{"playerRefId": 1, "winner": True, "score": "7"}]}],
    })
    assert import_text(Session, old).imported == 1
    with Session() as db:
        play = db.query(Play).one()
        assert play.outcome_type == "competitive"
        assert play.participants[0].is_winner is True


def test_edited_import_keeps_source_id_and_is_not_duplicated(api):
    client, _, Session = api
    plays = [{"uuid": "imp", "playDate": "2026-11-01T10:00:00Z", "gameRefId": 1,
              "playerScores": [{"playerRefId": 1, "winner": True},
                               {"playerRefId": 2}]}]
    text = export(plays)
    import_text(Session, text)
    with Session() as db:
        play_id = db.query(Play).one().id
    response = client.patch(f"/plays/{play_id}", json={
        "location": "Edited",
        "participants": [{"name": "Tom"}, {"name": "Eve", "is_winner": True}],
    })
    assert response.status_code == 200
    again = import_text(Session, text)
    assert (again.imported, again.skipped_existing) == (0, 1)
    with Session() as db:
        play = db.query(Play).one()
        assert (play.source, play.source_play_id, play.location) == ("bgstats", "imp", "Edited")
        assert {p.name: p.is_winner for p in play.participants} == {"Tom": False, "Eve": True}


def test_player_profile_and_history_use_new_outcomes(api):
    client, _, Session = api
    log(client, outcome_type="cooperative", coop_result="won",
        participants=[{"name": "Alex"}, {"name": "Sam"}])
    log(client, outcome_type="cooperative", coop_result="lost",
        participants=[{"name": "Alex"}, {"name": "Sam"}])
    log(client, participants=[{"name": "Alex", "rank": 1}, {"name": "Sam", "rank": 2}])
    log(client, participants=[{"name": "Alex"}, {"name": "Sam"}])
    alex = next(p for p in client.get("/players").json() if p["name"] == "Alex")
    stats = client.get(f"/players/{alex['id']}/stats").json()
    assert (stats["wins"], stats["losses"], stats["unknown_results"]) == (2, 1, 1)
    assert stats["win_rate"] == 66.7
    history = client.get("/games/100/plays").json()
    assert history["recent_plays"][0]["outcome_type"] in {
        "competitive", "cooperative"
    }


def test_cors_preflight_allows_patch_for_play_edits(api):
    client, _, _ = api
    from config import settings

    origin = settings.cors_origins[0]
    response = client.options(
        "/plays/1",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "PATCH",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
    )
    assert response.status_code == 200
    assert "PATCH" in response.headers["access-control-allow-methods"]


def test_list_plays_is_newest_first_paged_and_scoped_to_the_account(api):
    client, current, Session = api
    with Session() as db:
        db.add(UserGame(user_id=1, game_id=2))
        db.commit()
    ids = [
        log(client, bgg_id=100, played_at="2026-11-01T19:00:00Z"),
        log(client, bgg_id=200, played_at="2026-11-03T19:00:00Z"),
        log(client, bgg_id=100, played_at="2026-11-02T19:00:00Z"),
    ]
    current["value"] = SimpleNamespace(id=2, tier="FREE")
    log(client, bgg_id=100, played_at="2026-11-04T19:00:00Z")
    current["value"] = SimpleNamespace(id=1, tier="FREE")

    body = client.get("/plays").json()
    assert body["total"] == 3
    assert [play["id"] for play in body["plays"]] == [ids[1], ids[2], ids[0]]
    first = body["plays"][0]
    assert first["bgg_id"] == 200
    assert [p["name"] for p in first["participants"]] == ["Alex", "Sam"]
    assert first["participants"][0]["outcome"] == "win"

    page = client.get("/plays", params={"limit": 1, "offset": 1}).json()
    assert page["total"] == 3
    assert [play["id"] for play in page["plays"]] == [ids[2]]


def test_list_plays_empty_and_validates_paging(api):
    client, _, _ = api
    assert client.get("/plays").json() == {"total": 0, "plays": []}
    assert client.get("/plays", params={"limit": 0}).status_code == 422
    assert client.get("/plays", params={"limit": 201}).status_code == 422
    assert client.get("/plays", params={"offset": -1}).status_code == 422
