import json
from types import MethodType

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database.connection import Base
from database.models import Game, Play, User, UserGame
from api.dependencies import get_bgstats_play_import_service
from api.main import app
from api.routers.imports import MAX_BGSTATS_UPLOAD_BYTES
from repositories.play_repository import PlayRepository
from services.bgstats_play_import_service import BGStatsPlayImportService


def make_export(play_ids=("first", "second")) -> str:
    return json.dumps({
        "games": [{"id": 1, "bggId": 36218}],
        "players": [{"id": 1, "name": "Tom"}],
        "plays": [
            {
                "uuid": play_id,
                "playDate": "2026-11-03T12:00:00Z",
                "gameRefId": 1,
                "playerScores": [{"playerRefId": 1, "winner": True}],
            }
            for play_id in play_ids
        ],
    })


@pytest.fixture
def repository():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    user = User(email="import@example.com", tier="FREE")
    game = Game(bgg_id=36218, name="Dominion", owned=False)
    session.add_all([user, game])
    session.flush()
    session.add(UserGame(user_id=user.id, game_id=game.id))
    session.commit()
    result = PlayRepository(session, user_id=user.id)
    try:
        yield result
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_repeated_import_is_idempotent(repository: PlayRepository):
    service = BGStatsPlayImportService(repository)

    first = service.import_plays(make_export(("repeat",)))
    second = service.import_plays(make_export(("repeat",)))

    assert first.imported == 1
    assert second.skipped_existing == 1
    assert repository.db.query(Play).count() == 1


def test_import_rolls_back_all_writes_when_later_record_fails(
    repository: PlayRepository,
):
    original = repository.create_imported
    calls = 0

    def fail_second(self, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("simulated write failure")
        return original(**kwargs)

    repository.create_imported = MethodType(fail_second, repository)

    with pytest.raises(RuntimeError, match="simulated write failure"):
        BGStatsPlayImportService(repository).import_plays(make_export())

    assert repository.db.query(Play).count() == 0


def test_import_endpoint_rejects_oversized_upload_before_parsing():
    class UnexpectedService:
        def import_plays(self, _json_text):
            raise AssertionError("oversized body reached import service")

    app.dependency_overrides[get_bgstats_play_import_service] = (
        lambda: UnexpectedService()
    )
    try:
        response = TestClient(app).post(
            "/imports/bgstats/plays",
            files={
                "file": (
                    "export.json",
                    b"x" * (MAX_BGSTATS_UPLOAD_BYTES + 1),
                    "application/json",
                )
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 413
    assert response.json()["detail"] == "BG Stats export must be 10 MB or smaller"
