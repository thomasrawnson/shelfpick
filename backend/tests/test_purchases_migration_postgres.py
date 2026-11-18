"""Upgrade/downgrade of the Pro purchases migration on a disposable database."""

import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text

DATABASE_URL = os.getenv("PURCHASES_MIGRATION_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not DATABASE_URL,
    reason="requires an isolated PostgreSQL PURCHASES_MIGRATION_TEST_DATABASE_URL",
)

BACKEND = Path(__file__).resolve().parents[1]
PREVIOUS = "b8d2f4a6c1e3"
NEW = "c4e7a9b2d6f1"


def alembic(*args):
    env = {
        **os.environ, "DATABASE_URL": DATABASE_URL, "APP_ENV": "test",
        "JWT_SECRET": os.environ.get("JWT_SECRET", "migration-test-secret"),
    }
    subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND, env=env, check=True, capture_output=True,
    )


def test_purchases_migration_backfills_and_rolls_back():
    assert "test" in DATABASE_URL.casefold() or "migrat" in DATABASE_URL.casefold()
    engine = create_engine(DATABASE_URL)
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))

    alembic("upgrade", PREVIOUS)
    with engine.begin() as connection:
        connection.execute(text(
            "INSERT INTO users (email, tier) VALUES "
            "('free@example.com', 'FREE'), ('granted@example.com', 'PRO')"
        ))

    alembic("upgrade", NEW)
    with engine.begin() as connection:
        rows = connection.execute(text("SELECT email, tier, public_id FROM users")).all()
        assert {row.email: row.tier for row in rows if row.email.endswith("@example.com")} == {
            "free@example.com": "FREE", "granted@example.com": "PRO",
        }
        public_ids = {row.public_id for row in rows}
        assert len(public_ids) == len(rows) and all(len(value) == 36 for value in public_ids)

        # A server still on the previous release inserts users without it.
        connection.execute(text("INSERT INTO users (email) VALUES ('old-release@example.com')"))
        assert connection.execute(text(
            "SELECT public_id FROM users WHERE email = 'old-release@example.com'"
        )).scalar_one() not in public_ids

        user_id = connection.execute(text(
            "SELECT id FROM users WHERE email = 'free@example.com'"
        )).scalar_one()
        connection.execute(text(
            "INSERT INTO purchase_entitlements "
            "(user_id, status, plan, product_id, environment, last_synced_at) "
            "VALUES (:u, 'ACTIVE', 'LIFETIME', 'p', 'SANDBOX', now())"
        ), {"u": user_id})
    with pytest.raises(Exception), engine.begin() as connection:
        connection.execute(text(
            "INSERT INTO purchase_entitlements "
            "(user_id, status, plan, product_id, environment, last_synced_at) "
            "VALUES (:u, 'ACTIVE', 'LIFETIME', 'p', 'SANDBOX', now())"
        ), {"u": user_id})  # one row per user
    with pytest.raises(Exception), engine.begin() as connection:
        connection.execute(text(
            "INSERT INTO purchase_entitlements "
            "(user_id, status, plan, product_id, environment, last_synced_at) "
            "SELECT id, 'GRANTED', 'LIFETIME', 'p', 'SANDBOX', now() FROM users "
            "WHERE email = 'granted@example.com'"
        ))  # unknown status
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM users WHERE id = :u"), {"u": user_id})
        assert connection.execute(text("SELECT count(*) FROM purchase_entitlements")).scalar_one() == 0

    alembic("downgrade", PREVIOUS)
    assert "purchase_entitlements" not in inspect(engine).get_table_names()
    assert "public_id" not in {column["name"] for column in inspect(engine).get_columns("users")}
    alembic("upgrade", "head")
    assert "purchase_entitlements" in inspect(engine).get_table_names()
    engine.dispose()
