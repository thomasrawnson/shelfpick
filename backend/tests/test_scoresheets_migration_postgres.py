"""Upgrade/downgrade of the scoresheets migration on a seeded database."""

import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import MetaData, Table, create_engine, inspect, text
from sqlalchemy.orm import Session

from database.models import Game
from repositories.scoresheet_repository import ScoresheetRepository
from services.scoresheet_service import seed_builtin_scoresheets

DATABASE_URL = os.getenv("PLAY_MIGRATION_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not DATABASE_URL,
    reason="requires an isolated PostgreSQL PLAY_MIGRATION_TEST_DATABASE_URL",
)

BACKEND = Path(__file__).resolve().parents[1]
PREVIOUS = "a7c1e9d3b5f2"
NEW = "d2b6f0a9c4e8"
NOW = datetime(2026, 11, 1, 20, tzinfo=timezone.utc)


def alembic(*args):
    env = {**os.environ, "DATABASE_URL": DATABASE_URL, "APP_ENV": "test"}
    subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND, env=env, check=True, capture_output=True,
    )


def snapshot(engine):
    with engine.connect() as connection:
        return connection.execute(text(
            "SELECT p.id, p.outcome_type, pp.name, pp.score, pp.is_winner, "
            "pp.rank FROM plays p JOIN play_participants pp "
            "ON pp.play_id = p.id ORDER BY p.id, pp.name"
        )).all()


def test_upgrade_keeps_plays_seed_is_idempotent_and_downgrade_works():
    assert "test" in DATABASE_URL.casefold() or "migrat" in DATABASE_URL.casefold()
    engine = create_engine(DATABASE_URL)
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))

    alembic("upgrade", PREVIOUS)
    meta = MetaData()
    with engine.begin() as connection:
        users = Table("users", meta, autoload_with=connection)
        plays = Table("plays", meta, autoload_with=connection)
        parts = Table("play_participants", meta, autoload_with=connection)
        user_id = connection.execute(
            users.insert().values(email="fixture@example.com")
            .returning(users.c.id)
        ).scalar_one()
        orm = Session(bind=connection)
        game = Game(bgg_id=266192, name="Fixture", owned=True)
        orm.add(game)
        orm.flush()
        play_id = connection.execute(
            plays.insert().values(
                user_id=user_id, game_id=game.id, played_at=NOW,
                player_count=2,
            ).returning(plays.c.id)
        ).scalar_one()
        for name, score, rank in (("Ana", 80, 1), ("Ben", 70, 2)):
            connection.execute(parts.insert().values(
                play_id=play_id, name=name, score=score, rank=rank,
                is_winner=rank == 1,
            ))
    before = snapshot(engine)

    alembic("upgrade", NEW)
    assert snapshot(engine) == before
    with engine.connect() as connection:
        row = connection.execute(text(
            "SELECT scoresheet_id, scoresheet_version, result_overridden "
            "FROM plays"
        )).one()
        assert tuple(row) == (None, None, False)
        assert connection.execute(text(
            "SELECT count(*) FROM play_participants "
            "WHERE score_breakdown IS NOT NULL"
        )).scalar_one() == 0

    with Session(engine) as db:
        first = seed_builtin_scoresheets(ScoresheetRepository(db))
        second = seed_builtin_scoresheets(ScoresheetRepository(db))
    assert first["created"] >= 25 and first["updated"] == 0
    assert second == {"created": 0, "updated": 0,
                      "unchanged": first["created"]}

    alembic("downgrade", PREVIOUS)
    assert snapshot(engine) == before
    tables = inspect(engine).get_table_names()
    assert "scoresheets" not in tables
    assert "scoresheet_versions" not in tables

    alembic("upgrade", "head")
    engine.dispose()
