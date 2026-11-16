import os
from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from database.models import (
    Game,
    Play,
    PlayParticipant,
    Player,
    User,
    UserGame,
)
from repositories.play_repository import PlayRepository


DATABASE_URL = os.getenv("SCORESHEET_PERSISTENCE_DATABASE_URL")
EXPECTED_DATABASE = "shelfpick_score03a_test"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}

pytestmark = pytest.mark.skipif(
    not DATABASE_URL,
    reason="requires an isolated PostgreSQL SCORESHEET_PERSISTENCE_DATABASE_URL",
)


@pytest.fixture(scope="module")
def postgres_sessions():
    url = make_url(DATABASE_URL)
    assert url.drivername.startswith("postgresql")
    assert url.host in LOCAL_HOSTS
    assert url.database == EXPECTED_DATABASE

    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    try:
        yield sessions
    finally:
        engine.dispose()


@pytest.fixture()
def scoresheet_account(postgres_sessions):
    session = postgres_sessions()
    suffix = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    user = User(
        email=f"score03a-persistence-{suffix}@example.com",
        display_name="SP-SCORE-03A Persistence",
    )
    games = [
        Game(bgg_id=266192, name="Wingspan", owned=True),
        Game(bgg_id=167791, name="Terraforming Mars", owned=True),
        Game(bgg_id=414317, name="Harmonies", owned=True),
    ]
    session.add_all([user, *games])
    session.flush()
    session.add_all(
        UserGame(user_id=user.id, game_id=game.id, source="score03a-test")
        for game in games
    )
    session.commit()
    result = {
        "user_id": user.id,
        "game_ids": {game.bgg_id: game.id for game in games},
    }
    session.close()

    try:
        yield result
    finally:
        cleanup = postgres_sessions()
        cleanup.query(User).filter(User.id == result["user_id"]).delete()
        cleanup.query(Game).filter(Game.id.in_(result["game_ids"].values())).delete(
            synchronize_session=False,
        )
        cleanup.commit()
        cleanup.close()


def test_scoresheet_and_manual_plays_survive_round_trip(
    postgres_sessions,
    scoresheet_account,
):
    user_id = scoresheet_account["user_id"]
    writer_session = postgres_sessions()
    repository = PlayRepository(writer_session, user_id)

    manual = repository.create(
        bgg_id=266192,
        played_at=datetime(2026, 10, 31, 18, 0, tzinfo=timezone.utc),
        duration_minutes=50,
        participants=[
            {"name": "Alex", "score": None, "is_winner": False},
            {"name": "Morgan", "score": None, "is_winner": True},
        ],
        location="Manual table",
    )
    wingspan = repository.create(
        bgg_id=266192,
        played_at=datetime(2026, 11, 1, 18, 0, tzinfo=timezone.utc),
        duration_minutes=60,
        participants=[
            {"name": "Alex", "score": 90, "is_winner": True},
            {"name": "Morgan", "score": 90, "is_winner": True},
        ],
        location="Scoresheet table",
    )
    terraforming_mars = repository.create(
        bgg_id=167791,
        played_at=datetime(2026, 11, 1, 19, 0, tzinfo=timezone.utc),
        duration_minutes=120,
        participants=[
            {"name": "Alex", "score": 100, "is_winner": True},
            {"name": "Morgan", "score": 98, "is_winner": False},
        ],
    )
    harmonies = repository.create(
        bgg_id=414317,
        played_at=datetime(2026, 11, 1, 20, 0, tzinfo=timezone.utc),
        duration_minutes=35,
        participants=[
            {"name": "Alex", "score": 70, "is_winner": False},
            {"name": "Morgan", "score": 75, "is_winner": True},
        ],
    )
    writer_session.close()

    reader_session = postgres_sessions()
    reader = PlayRepository(reader_session, user_id)
    histories = {
        bgg_id: reader.get_game_history(bgg_id)
        for bgg_id in (266192, 167791, 414317)
    }

    assert histories[266192]["bgg_id"] == 266192
    assert histories[266192]["play_count"] == 2
    assert histories[167791]["bgg_id"] == 167791
    assert histories[414317]["bgg_id"] == 414317

    wingspan_saved = histories[266192]["recent_plays"][0]
    assert wingspan_saved["id"] == wingspan.id
    assert wingspan_saved["location"] == "Scoresheet table"
    assert [(item["name"], item["score"], item["is_winner"]) for item in wingspan_saved["participants"]] == [
        ("Alex", 90.0, True),
        ("Morgan", 90.0, True),
    ]

    manual_saved = histories[266192]["recent_plays"][1]
    assert manual_saved["id"] == manual.id
    assert manual_saved["location"] == "Manual table"
    assert [(item["score"], item["is_winner"]) for item in manual_saved["participants"]] == [
        (None, False),
        (None, True),
    ]

    assert histories[167791]["recent_plays"][0]["id"] == terraforming_mars.id
    assert [(item["score"], item["is_winner"]) for item in histories[167791]["recent_plays"][0]["participants"]] == [
        (100.0, True),
        (98.0, False),
    ]
    assert histories[414317]["recent_plays"][0]["id"] == harmonies.id
    assert [(item["score"], item["is_winner"]) for item in histories[414317]["recent_plays"][0]["participants"]] == [
        (70.0, False),
        (75.0, True),
    ]

    alex = reader_session.scalar(
        select(Player).where(Player.user_id == user_id, Player.normalized_name == "alex"),
    )
    alex_participants = reader_session.scalars(
        select(PlayParticipant).join(Play).where(
            Play.user_id == user_id,
            PlayParticipant.player_id == alex.id,
        ),
    ).all()
    assert len(alex_participants) == 4
    assert {participant.play.game_id for participant in alex_participants} == set(
        scoresheet_account["game_ids"].values(),
    )
    reader_session.close()
