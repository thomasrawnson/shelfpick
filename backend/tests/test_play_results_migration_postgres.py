"""Upgrade/downgrade of the play-results migration on a seeded fixture."""

import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import MetaData, Table, create_engine, text
from sqlalchemy.orm import Session

from database.models import Game

DATABASE_URL = os.getenv("PLAY_MIGRATION_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not DATABASE_URL,
    reason="requires an isolated PostgreSQL PLAY_MIGRATION_TEST_DATABASE_URL",
)

BACKEND = Path(__file__).resolve().parents[1]
PREVIOUS = "f3a8c2d4e6b1"
NEW = "a7c1e9d3b5f2"
NOW = datetime(2026, 11, 1, 20, tzinfo=timezone.utc)

# (winner flags, scores) per seeded play, and the outcomes they must yield
# for each participant both before and after the migration.
SEED = [
    ([True, False], [10, 5], ["win", "loss"]),
    ([False, True], [5, 10], ["loss", "win"]),
    ([True, True], [7, 7], ["draw", "draw"]),
    ([True, True], [9, 4], ["win", "win"]),
    ([False, False], [None, None], ["unknown", "unknown"]),
    ([False], [None], ["unknown"]),
]


def alembic(*args):
    env = {**os.environ, "DATABASE_URL": DATABASE_URL, "APP_ENV": "test"}
    subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND, env=env, check=True, capture_output=True,
    )


def test_backfill_keeps_outcomes_and_downgrade_works():
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
            users.insert().values(email="fixture@example.com").returning(users.c.id)
        ).scalar_one()
        # The games table is unchanged by this migration, so the ORM model
        # fills its many required columns with their defaults.
        orm = Session(bind=connection)
        game = Game(bgg_id=1, name="Fixture", owned=True)
        orm.add(game)
        orm.flush()
        game_id = game.id
        for flags, scores, _ in SEED:
            play_id = connection.execute(
                plays.insert().values(
                    user_id=user_id, game_id=game_id, played_at=NOW,
                    player_count=len(flags),
                ).returning(plays.c.id)
            ).scalar_one()
            for index, (flag, score) in enumerate(zip(flags, scores)):
                connection.execute(parts.insert().values(
                    play_id=play_id, name=f"P{index}", score=score, is_winner=flag,
                ))

    def winner_flags():
        with engine.connect() as connection:
            return connection.execute(text(
                "SELECT play_id, name, is_winner FROM play_participants "
                "ORDER BY play_id, name"
            )).all()

    before = winner_flags()
    alembic("upgrade", NEW)
    assert winner_flags() == before

    from services.play_results import resolve_outcome

    with engine.connect() as connection:
        plays_rows = connection.execute(text(
            "SELECT id, outcome_type, coop_result FROM plays ORDER BY id"
        )).all()
        assert all(r.outcome_type == "competitive" and r.coop_result is None
                   for r in plays_rows)
        part_rows = connection.execute(text(
            "SELECT play_id, score, is_winner, team, rank, role "
            "FROM play_participants ORDER BY play_id, name"
        )).all()
    assert all(r.team is None and r.rank is None and r.role is None for r in part_rows)

    counts = {"win": 0, "loss": 0, "draw": 0, "unknown": 0}
    expected = {"win": 0, "loss": 0, "draw": 0, "unknown": 0}
    for play_row, (_, _, wanted) in zip(plays_rows, SEED):
        members = [
            SimpleNamespace(score=r.score, is_winner=r.is_winner, team=r.team, rank=r.rank)
            for r in part_rows if r.play_id == play_row.id
        ]
        play = SimpleNamespace(
            outcome_type=play_row.outcome_type,
            coop_result=play_row.coop_result,
            participants=members,
        )
        for member, want in zip(members, wanted):
            got = resolve_outcome(member, play)
            assert got == want
            counts[got] += 1
            expected[want] += 1
    assert counts == expected == {"win": 4, "loss": 2, "draw": 2, "unknown": 3}

    alembic("downgrade", PREVIOUS)
    assert winner_flags() == before
    with engine.connect() as connection:
        columns = {
            row[0] for row in connection.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name IN ('plays', 'play_participants')"
            ))
        }
    assert not columns & {"outcome_type", "coop_result", "team", "rank", "role"}
    alembic("upgrade", "head")
    engine.dispose()
