"""Scoresheet API, seeding and plays logged with breakdowns."""

import json
import shutil
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from api.current_user import get_current_user
from api.main import app
from database.connection import Base, get_db
from database.models import Game, Scoresheet, ScoresheetVersion, User, UserGame
from repositories.scoresheet_repository import ScoresheetRepository
from services.account_service import AccountService
from services.scoresheet_service import seed_builtin_scoresheets
from services.scoresheet_validation import SCORESHEETS_DIR, TEMPLATES_DIR

TEMPLATES = {
    json.loads(path.read_text())["bgg_id"]: json.loads(path.read_text())
    for path in sorted(TEMPLATES_DIR.glob("*.json"))
}
FIXTURES = sorted((SCORESHEETS_DIR / "fixtures").glob("*.json"))
WINGSPAN, SKYJO, HANABI, CATAN = 266192, 204135, 98778, 13
CUSTOM_GAME = 555


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
            User(id=1, email="pro@example.com", tier="PRO"),
            User(id=2, email="free@example.com", tier="FREE"),
        ])
        for index, bgg_id in enumerate([*TEMPLATES, CUSTOM_GAME], start=1):
            db.add(Game(id=index, bgg_id=bgg_id, name=f"Game {bgg_id}",
                        owned=True))
            db.flush()
            db.add_all([
                UserGame(user_id=1, game_id=index),
                UserGame(user_id=2, game_id=index),
            ])
        db.commit()
        seed_builtin_scoresheets(ScoresheetRepository(db))
    current = {"value": SimpleNamespace(id=1, tier="PRO")}

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


def as_free(current):
    current["value"] = SimpleNamespace(id=2, tier="FREE")


def builtin_id(client, bgg_id):
    sheets = client.get("/scoresheets", params={"bgg_id": bgg_id}).json()
    return next(s["id"] for s in sheets if s["kind"] == "builtin")


def log(client, bgg_id, sheet_id, players, **extra):
    body = {
        "bgg_id": bgg_id,
        "played_at": "2026-11-01T19:00:00Z",
        "scoresheet_id": sheet_id,
        "participants": [
            {"name": name, "score_breakdown": scores}
            for name, scores in players
        ],
        **extra,
    }
    return client.post("/plays", json=body)


def history(client, bgg_id):
    return client.get(f"/games/{bgg_id}/plays").json()


def play_by_id(client, bgg_id, play_id):
    plays = history(client, bgg_id)
    plays = plays["recent_plays"]
    return next(p for p in plays if p["id"] == play_id)


@pytest.mark.parametrize("path", FIXTURES, ids=lambda p: p.stem)
def test_every_fixture_through_the_backend(api, path):
    client, _, _ = api
    fixture = json.loads(path.read_text())
    bgg_id = fixture["bgg_id"]
    template = TEMPLATES[bgg_id]
    players = [(p["name"], p["scores"]) for p in fixture["players"]]
    extra = {}
    if template["win_condition"] == "cooperative":
        extra["coop_result"] = "won"
    response = log(client, bgg_id, builtin_id(client, bgg_id), players, **extra)
    assert response.status_code == 201, response.text

    play = play_by_id(client, bgg_id, response.json()["id"])
    totals = {p["name"]: p["score"] for p in play["participants"]}
    assert totals == fixture["expected"]["totals"]
    winners = sorted(p["name"] for p in play["participants"] if p["is_winner"])
    if template["win_condition"] == "cooperative":
        assert play["outcome_type"] == "cooperative"
    else:
        assert winners == sorted(fixture["expected"]["winner"])
    assert play["scoresheet_version"] == 1
    assert play["participants"][0]["score_breakdown"] == players[0][1]


def test_seeding_is_idempotent_and_a_bump_keeps_old_plays(api, tmp_path):
    client, _, Session = api
    sheet_id = builtin_id(client, SKYJO)
    played = log(client, SKYJO, sheet_id, [
        ("Ana", {"round_points": [10, 5]}), ("Ben", {"round_points": [3, 4]}),
    ])
    assert played.status_code == 201
    play_id = played.json()["id"]

    with Session() as db:
        repo = ScoresheetRepository(db)
        assert seed_builtin_scoresheets(repo) == {
            "created": 0, "updated": 0, "unchanged": len(TEMPLATES),
        }
        folder = tmp_path / "templates"
        shutil.copytree(TEMPLATES_DIR, folder)
        skyjo = next(folder.glob(f"{SKYJO}-*.json"))
        changed = json.loads(skyjo.read_text())
        changed["categories"][0]["points_per"] = 2
        changed["categories"].append({
            "id": "went_out", "label": "Went out first", "help": "Tick it.",
            "type": "boolean", "points_per": -1, "allow_negative": False,
            "scope": "once",
        })
        skyjo.write_text(json.dumps(changed))
        assert seed_builtin_scoresheets(repo, folder)["updated"] == 1
        assert seed_builtin_scoresheets(repo, folder)["updated"] == 0
        assert db.query(ScoresheetVersion).filter_by(
            scoresheet_id=sheet_id).count() == 2

    # The old play still reads and edits on version 1.
    old = play_by_id(client, SKYJO, play_id)
    assert old["scoresheet_version"] == 1
    v1 = client.get(f"/scoresheets/{sheet_id}", params={"version": 1}).json()
    assert v1["schema"]["categories"][0]["points_per"] == 1
    assert v1["current_version"] == 2
    edited = client.patch(f"/plays/{play_id}", json={
        "participants": [
            {"name": "Ana", "score_breakdown": {"round_points": [1, 1]}},
            {"name": "Ben", "score_breakdown": {"round_points": [3, 4]}},
        ],
    })
    assert edited.status_code == 200, edited.text
    body = edited.json()
    assert body["scoresheet_version"] == 1
    assert [p["score"] for p in body["participants"]] == [2, 7]
    assert [p["is_winner"] for p in body["participants"]] == [True, False]

    # A new play takes the current version.
    new = log(client, SKYJO, sheet_id, [
        ("Ana", {"round_points": [1], "went_out": True}),
        ("Ben", {"round_points": [1]}),
    ])
    assert new.status_code == 201
    new_play = play_by_id(client, SKYJO, new.json()["id"])
    assert new_play["scoresheet_version"] == 2
    assert [p["score"] for p in new_play["participants"]] == [1, 2]


def test_invalid_template_stops_seeding(api, tmp_path):
    _, _, Session = api
    folder = tmp_path / "templates"
    folder.mkdir()
    (folder / "1-bad.json").write_text(json.dumps({"bgg_id": 1}))
    with Session() as db, pytest.raises(ValueError, match="Invalid"):
        seed_builtin_scoresheets(ScoresheetRepository(db), folder)


def test_editing_a_breakdown_recalculates_the_outcome(api):
    client, _, _ = api
    sheet_id = builtin_id(client, WINGSPAN)
    play_id = log(client, WINGSPAN, sheet_id, [
        ("Ana", {"birds": 50}), ("Ben", {"birds": 40}),
    ]).json()["id"]
    edited = client.patch(f"/plays/{play_id}", json={"participants": [
        {"name": "Ana", "score_breakdown": {"birds": 30}},
        {"name": "Ben", "score_breakdown": {"birds": 40, "eggs": 2}},
    ]}).json()
    assert [p["score"] for p in edited["participants"]] == [30, 42]
    assert [p["rank"] for p in edited["participants"]] == [2, 1]
    assert [p["outcome"] for p in edited["participants"]] == ["loss", "win"]

    # Changing only the date keeps the breakdowns.
    dated = client.patch(
        f"/plays/{play_id}", json={"played_at": "2026-11-02T19:00:00Z"},
    ).json()
    assert dated["participants"][1]["score_breakdown"] == {
        "birds": 40, "eggs": 2,
    }


def test_client_scores_are_ignored_and_override_is_kept(api):
    client, _, _ = api
    sheet_id = builtin_id(client, WINGSPAN)
    response = client.post("/plays", json={
        "bgg_id": WINGSPAN,
        "scoresheet_id": sheet_id,
        "participants": [
            {"name": "Ana", "score": 999, "is_winner": True,
             "score_breakdown": {"birds": 10}},
            {"name": "Ben", "score": 0, "score_breakdown": {"birds": 20}},
        ],
    })
    play = play_by_id(client, WINGSPAN, response.json()["id"])
    assert [p["score"] for p in play["participants"]] == [10, 20]
    assert [p["is_winner"] for p in play["participants"]] == [False, True]
    assert play["result_overridden"] is False

    overridden = client.patch(f"/plays/{play['id']}", json={
        "result_override": True,
        "participants": [
            {"name": "Ana", "rank": 1, "score_breakdown": {"birds": 10}},
            {"name": "Ben", "rank": 2, "score_breakdown": {"birds": 20}},
        ],
    }).json()
    assert overridden["result_overridden"] is True
    assert [p["is_winner"] for p in overridden["participants"]] == [True, False]
    assert [p["score"] for p in overridden["participants"]] == [10, 20]

    back = client.patch(f"/plays/{play['id']}", json={
        "result_override": False,
    }).json()
    assert [p["is_winner"] for p in back["participants"]] == [False, True]


def test_lowest_wins_and_cooperative_and_solo_target(api):
    client, _, _ = api
    low = log(client, SKYJO, builtin_id(client, SKYJO), [
        ("Ana", {"round_points": [40, -2]}), ("Ben", {"round_points": [12]}),
    ])
    play = play_by_id(client, SKYJO, low.json()["id"])
    assert [p["is_winner"] for p in play["participants"]] == [False, True]

    hanabi = builtin_id(client, HANABI)
    team = {"red": 5, "yellow": 5, "green": 4, "blue": 3, "white": 1}
    missing = log(client, HANABI, hanabi, [("Ana", team), ("Ben", team)])
    assert missing.status_code == 400
    assert "Won or Lost" in missing.json()["detail"]
    mismatched = log(client, HANABI, hanabi,
                     [("Ana", team), ("Ben", {"red": 1})], coop_result="won")
    assert mismatched.status_code == 400
    coop = log(client, HANABI, hanabi, [("Ana", team), ("Ben", team)],
               coop_result="won")
    play = play_by_id(client, HANABI, coop.json()["id"])
    assert play["outcome_type"] == "cooperative"
    assert [p["score"] for p in play["participants"]] == [18, 18]
    assert [p["outcome"] for p in play["participants"]] == ["win", "win"]

    solo = log(client, CATAN, builtin_id(client, CATAN), [
        ("Ana", {"settlements": 2, "cities": 4}),
    ])
    assert solo.status_code == 201, solo.text
    play = play_by_id(client, CATAN, solo.json()["id"])
    assert play["outcome_type"] == "solo"
    assert play["coop_result"] == "won"


def test_breakdown_validation(api):
    client, _, _ = api
    sheet_id = builtin_id(client, WINGSPAN)
    bad = log(client, WINGSPAN, sheet_id, [
        ("Ana", {"birds": -3}), ("Ben", {"wat": 1}),
    ])
    assert bad.status_code == 400
    assert "negative" in bad.json()["detail"]
    wrong_game = log(client, SKYJO, sheet_id, [("Ana", {}), ("Ben", {})])
    assert wrong_game.status_code == 400
    no_sheet = client.post("/plays", json={
        "bgg_id": WINGSPAN,
        "participants": [{"name": "Ana", "score_breakdown": {"birds": 1}}],
    })
    assert no_sheet.status_code == 400
    missing_entries = client.post("/plays", json={
        "bgg_id": WINGSPAN,
        "scoresheet_id": sheet_id,
        "participants": [{"name": "Ana", "score": 4}],
    })
    assert missing_entries.status_code == 400


def test_clearing_the_scoresheet_keeps_totals(api):
    client, _, _ = api
    sheet_id = builtin_id(client, WINGSPAN)
    play_id = log(client, WINGSPAN, sheet_id, [
        ("Ana", {"birds": 5}), ("Ben", {"birds": 9}),
    ]).json()["id"]
    plain = client.patch(f"/plays/{play_id}", json={"scoresheet_id": None})
    assert plain.status_code == 200, plain.text
    body = plain.json()
    assert body["scoresheet_id"] is None
    assert [p["score"] for p in body["participants"]] == [5, 9]
    assert all(p["score_breakdown"] is None for p in body["participants"])


def custom(name="House rules", bgg_id=CUSTOM_GAME, **overrides):
    return {
        "format_version": 1,
        "bgg_id": bgg_id,
        "name": name,
        "supported_players": [2, 4],
        "win_condition": "highest",
        "rounds": None,
        "categories": [
            {"id": "gems", "label": "Gems", "help": "Gems held.",
             "type": "count", "points_per": 3, "allow_negative": False,
             "scope": "once"},
        ],
        "tie_breakers": ["shared"],
        "source": {"rulebook_title": "Mine", "edition_or_year": "2026",
                   "checked_against_rulebook": True},
        "notes": "",
        **overrides,
    }


def test_custom_sheets_are_gated_and_isolated(api):
    client, current, _ = api
    created = client.post("/scoresheets", json={"schema": custom()})
    assert created.status_code == 201, created.text
    sheet = created.json()
    assert sheet["kind"] == "custom"
    assert sheet["schema"]["source"]["checked_against_rulebook"] is False
    assert [s["id"] for s in client.get("/scoresheets/mine").json()] == [
        sheet["id"]
    ]

    play = log(client, CUSTOM_GAME, sheet["id"],
               [("Ana", {"gems": 2}), ("Ben", {"gems": 1})])
    assert play.status_code == 201

    as_free(current)
    assert client.post("/scoresheets", json={"schema": custom()}).status_code == 403
    assert client.get("/scoresheets/mine").status_code == 403
    assert client.put(
        f"/scoresheets/{sheet['id']}", json={"schema": custom()},
    ).status_code == 403
    assert client.delete(f"/scoresheets/{sheet['id']}").status_code == 403
    # Another account never sees or uses someone else's sheet.
    assert client.get("/scoresheets", params={"bgg_id": CUSTOM_GAME}).json() == []
    assert client.get(f"/scoresheets/{sheet['id']}").status_code == 404
    stolen = log(client, CUSTOM_GAME, sheet["id"],
                 [("Ana", {"gems": 2}), ("Ben", {"gems": 1})])
    assert stolen.status_code == 400
    assert stolen.json()["detail"] == "Scoresheet not found."

    current["value"] = SimpleNamespace(id=2, tier="PRO")
    assert client.put(
        f"/scoresheets/{sheet['id']}", json={"schema": custom()},
    ).status_code == 404
    assert client.delete(f"/scoresheets/{sheet['id']}").status_code == 404


def test_custom_sheet_update_versions_and_delete_archives(api):
    client, _, _ = api
    sheet = client.post("/scoresheets", json={"schema": custom()}).json()
    play_id = log(client, CUSTOM_GAME, sheet["id"],
                  [("Ana", {"gems": 2}), ("Ben", {"gems": 1})]).json()["id"]

    renamed = custom(name="House rules v2", categories=[
        {"id": "gems", "label": "Gems", "help": "Gems held.", "type": "count",
         "points_per": 5, "allow_negative": False, "scope": "once"},
    ])
    updated = client.put(f"/scoresheets/{sheet['id']}", json={"schema": renamed})
    assert updated.json()["version"] == 2
    same = client.put(f"/scoresheets/{sheet['id']}", json={"schema": renamed})
    assert same.json()["version"] == 2

    assert client.delete(f"/scoresheets/{sheet['id']}").status_code == 204
    assert client.get("/scoresheets/mine").json() == []
    assert client.get("/scoresheets", params={"bgg_id": CUSTOM_GAME}).json() == []
    # Plays on the archived sheet stay readable and editable.
    old = client.get(f"/scoresheets/{sheet['id']}", params={"version": 1})
    assert old.status_code == 200 and old.json()["archived"] is True
    edited = client.patch(f"/plays/{play_id}", json={"participants": [
        {"name": "Ana", "score_breakdown": {"gems": 1}},
        {"name": "Ben", "score_breakdown": {"gems": 4}},
    ]})
    assert [p["score"] for p in edited.json()["participants"]] == [3, 12]


def test_invalid_custom_sheets_are_rejected(api):
    client, _, _ = api
    bad = custom(tie_breakers=["missing"])
    response = client.post("/scoresheets", json={"schema": bad})
    assert response.status_code == 400
    assert "tie_breaker missing" in response.json()["detail"]
    huge = custom(categories=[
        {"id": f"c{i}", "label": "C", "help": "C.", "type": "count",
         "points_per": 1, "allow_negative": False, "scope": "once"}
        for i in range(41)
    ])
    assert client.post("/scoresheets", json={"schema": huge}).status_code == 400


def test_account_deletion_removes_custom_sheets(api, monkeypatch):
    client, _, Session = api
    sheet = client.post("/scoresheets", json={"schema": custom()}).json()
    client.put(f"/scoresheets/{sheet['id']}", json={"schema": custom(name="B")})
    monkeypatch.setattr(
        "services.account_service.verify_password", lambda *_: True,
    )
    with Session() as db:
        user = db.get(User, 1)
        user.password_hash = "hash"
        AccountService(db).delete_account(user, "secret")
    with Session() as db:
        assert db.query(Scoresheet).filter(
            Scoresheet.owner_user_id.is_not(None)
        ).count() == 0
        assert db.query(ScoresheetVersion).filter_by(
            scoresheet_id=sheet["id"]
        ).count() == 0
        assert db.query(Scoresheet).count() == len(TEMPLATES)
