"""Upgrade and downgrade of the plays.client_id migration on a disposable PostgreSQL database."""

import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import MetaData, Table, create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database.models import Game

DATABASE_URL = os.getenv("CLIENT_ID_MIGRATION_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not DATABASE_URL,
    reason="requires an isolated PostgreSQL CLIENT_ID_MIGRATION_TEST_DATABASE_URL",
)

BACKEND = Path(__file__).resolve().parents[1]
PREVIOUS = "c4e7a9b2d6f1"
NEW = "e5b8c2f1a7d4"
NOW = datetime(2026, 11, 1, 20, tzinfo=timezone.utc)
CLIENT_ID = "6f1c1f0e-8a49-4f3c-9d3e-0c6f6d3a2b11"


def alembic(*args):
    env = {
        **os.environ, "DATABASE_URL": DATABASE_URL, "APP_ENV": "test",
        "JWT_SECRET": os.environ.get("JWT_SECRET", "migration-test-secret"),
    }
    subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND, env=env, check=True, capture_output=True,
    )


def play_columns(engine):
    return {column["name"] for column in inspect(engine).get_columns("plays")}


def unique_names(engine):
    return {c["name"] for c in inspect(engine).get_unique_constraints("plays")}


def test_upgrade_keeps_plays_enforces_the_pair_and_downgrade_works():
    assert "test" in DATABASE_URL.casefold() or "migrat" in DATABASE_URL.casefold()
    engine = create_engine(DATABASE_URL)
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))

    alembic("upgrade", PREVIOUS)
    assert "client_id" not in play_columns(engine)
    meta = MetaData()
    with engine.begin() as connection:
        users = Table("users", meta, autoload_with=connection)
        plays = Table("plays", meta, autoload_with=connection)
        ids = [
            connection.execute(users.insert().values(email=f"{name}@example.com").returning(users.c.id)).scalar_one()
            for name in ("one", "two")
        ]
        orm = Session(bind=connection)
        game = Game(bgg_id=266192, name="Fixture", owned=True)
        orm.add(game)
        orm.flush()
        game_id = game.id
        for _ in range(2):
            connection.execute(plays.insert().values(
                user_id=ids[0], game_id=game_id, played_at=NOW, player_count=2,
            ))
        before = connection.execute(text("SELECT id, player_count FROM plays ORDER BY id")).all()

    alembic("upgrade", NEW)
    assert "client_id" in play_columns(engine)
    assert "uq_plays_user_client_id" in unique_names(engine)
    with engine.begin() as connection:
        # Existing plays are untouched and keep a null id; two nulls for one user are fine.
        assert connection.execute(text("SELECT id, player_count FROM plays ORDER BY id")).all() == before
        assert connection.execute(text("SELECT count(*) FROM plays WHERE client_id IS NULL")).scalar_one() == 2
        insert = text(
            "INSERT INTO plays (user_id, game_id, played_at, player_count, client_id) "
            "VALUES (:user, :game, now(), 1, :client)"
        )
        connection.execute(insert, {"user": ids[0], "game": game_id, "client": CLIENT_ID})
        # The same id for another user is allowed.
        connection.execute(insert, {"user": ids[1], "game": game_id, "client": CLIENT_ID})
    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(insert, {"user": ids[0], "game": game_id, "client": CLIENT_ID})

    alembic("downgrade", PREVIOUS)
    assert "client_id" not in play_columns(engine)
    assert "uq_plays_user_client_id" not in unique_names(engine)
    with engine.begin() as connection:
        assert connection.execute(text("SELECT count(*) FROM plays")).scalar_one() == 4

    alembic("upgrade", NEW)
    alembic("check")
    assert "client_id" in play_columns(engine)
