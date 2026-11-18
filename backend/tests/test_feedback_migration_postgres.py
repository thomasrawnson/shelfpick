"""Upgrade/downgrade of the feedback migration on a disposable database."""

import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text

DATABASE_URL = os.getenv("FEEDBACK_MIGRATION_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not DATABASE_URL,
    reason="requires an isolated PostgreSQL FEEDBACK_MIGRATION_TEST_DATABASE_URL",
)

BACKEND = Path(__file__).resolve().parents[1]
PREVIOUS = "d2b6f0a9c4e8"
NEW = "b8d2f4a6c1e3"


def alembic(*args):
    env = {**os.environ, "DATABASE_URL": DATABASE_URL, "APP_ENV": "test"}
    subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND, env=env, check=True, capture_output=True,
    )


def test_feedback_table_applies_and_rolls_back():
    assert "test" in DATABASE_URL.casefold() or "migrat" in DATABASE_URL.casefold()
    engine = create_engine(DATABASE_URL)
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))

    alembic("upgrade", PREVIOUS)
    assert "feedback" not in inspect(engine).get_table_names()

    alembic("upgrade", NEW)
    columns = {column["name"] for column in inspect(engine).get_columns("feedback")}
    assert columns == {
        "id", "user_id", "type", "message", "wants_reply",
        "app_version", "build", "os", "device", "created_at",
    }
    with engine.begin() as connection:
        user_id = connection.execute(text(
            "INSERT INTO users (email) VALUES ('fixture@example.com') RETURNING id"
        )).scalar_one()
        connection.execute(text(
            "INSERT INTO feedback (user_id, type, message) VALUES (:u, 'problem', 'Fixture message.')"
        ), {"u": user_id})
        assert connection.execute(text("SELECT wants_reply FROM feedback")).scalar_one() is False
    with pytest.raises(Exception), engine.begin() as connection:
        connection.execute(text(
            "INSERT INTO feedback (user_id, type, message) VALUES (:u, 'praise', 'Bad type.')"
        ), {"u": user_id})
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM users WHERE id = :u"), {"u": user_id})
        assert connection.execute(text("SELECT count(*) FROM feedback")).scalar_one() == 0

    alembic("downgrade", PREVIOUS)
    assert "feedback" not in inspect(engine).get_table_names()
    alembic("upgrade", "head")
    assert "feedback" in inspect(engine).get_table_names()
    engine.dispose()
