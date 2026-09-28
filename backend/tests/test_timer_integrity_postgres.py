import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from threading import Barrier

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from database.connection import Base
from database.models import Game, LivePlayTimer, Play, User, UserGame
from repositories.live_timer_repository import LiveTimerRepository
from repositories.play_repository import PlayRepository
from services.live_timer_service import LiveTimerService


DATABASE_URL = os.getenv("TIMER_INTEGRITY_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not DATABASE_URL,
    reason="requires an isolated PostgreSQL TIMER_INTEGRITY_DATABASE_URL",
)


@pytest.fixture(scope="module")
def postgres_sessions():
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    try:
        yield sessions
    finally:
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture()
def timer_accounts(postgres_sessions):
    session = postgres_sessions()
    suffix = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    users = [
        User(email=f"timer-integrity-{suffix}-{index}@example.com", tier="PRO")
        for index in (1, 2)
    ]
    games = [
        Game(
            bgg_id=int(f"91{suffix[-6:]}{index}"),
            name=f"Timer game {index}",
            owned=True,
        )
        for index in (1, 2)
    ]
    session.add_all([*users, *games])
    session.flush()
    session.add_all(
        UserGame(user_id=user.id, game_id=game.id)
        for user in users
        for game in games
    )
    session.commit()
    result = {
        "user_ids": [user.id for user in users],
        "game_ids": [game.id for game in games],
        "bgg_ids": [game.bgg_id for game in games],
    }
    session.close()
    return result


def test_concurrent_start_creates_one_account_timer(postgres_sessions, timer_accounts):
    barrier = Barrier(2)

    def start_timer():
        session = postgres_sessions()
        try:
            barrier.wait()
            return LiveTimerService(
                LiveTimerRepository(session, timer_accounts["user_ids"][0])
            ).start(timer_accounts["bgg_ids"][0])
        except ValueError as exc:
            return str(exc)
        finally:
            session.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: start_timer(), range(2)))

    session = postgres_sessions()
    try:
        timer_count = session.scalar(
            select(func.count()).select_from(LivePlayTimer).where(
                LivePlayTimer.user_id == timer_accounts["user_ids"][0]
            )
        )
    finally:
        session.close()

    assert timer_count == 1
    assert sum(isinstance(result, dict) for result in results) == 1
    assert "Finish or discard the current timer first." in results


def test_concurrent_and_repeated_timer_save_creates_one_play(
    postgres_sessions, timer_accounts
):
    session = postgres_sessions()
    service = LiveTimerService(
        LiveTimerRepository(session, timer_accounts["user_ids"][0])
    )
    timer_id = service.start(timer_accounts["bgg_ids"][0])["public_id"]
    service.finish()
    session.close()
    barrier = Barrier(2)

    def save_play():
        worker_session = postgres_sessions()
        try:
            barrier.wait()
            return PlayRepository(
                worker_session, timer_accounts["user_ids"][0]
            ).create(
                bgg_id=timer_accounts["bgg_ids"][0],
                played_at=None,
                duration_minutes=1,
                participants=[{"name": "Alex", "is_winner": False}],
                timer_session_id=timer_id,
            )
        finally:
            worker_session.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: save_play(), range(2)))

    retry_session = postgres_sessions()
    try:
        repeated = PlayRepository(
            retry_session, timer_accounts["user_ids"][0]
        ).create(
            bgg_id=timer_accounts["bgg_ids"][0],
            played_at=None,
            duration_minutes=1,
            participants=[{"name": "Alex", "is_winner": False}],
            timer_session_id=timer_id,
        )
        play_count = retry_session.scalar(
            select(func.count()).select_from(Play).where(
                Play.timer_session_id == timer_id
            )
        )
        timer_count = retry_session.scalar(
            select(func.count()).select_from(LivePlayTimer).where(
                LivePlayTimer.public_id == timer_id
            )
        )
    finally:
        retry_session.close()

    assert results[0].id == results[1].id == repeated.id
    assert play_count == 1
    assert timer_count == 0


def test_other_account_cannot_read_control_discard_or_save_timer(
    postgres_sessions, timer_accounts
):
    owner_session = postgres_sessions()
    owner = LiveTimerService(
        LiveTimerRepository(owner_session, timer_accounts["user_ids"][0])
    )
    timer_id = owner.start(timer_accounts["bgg_ids"][0])["public_id"]
    owner.finish()
    owner_session.close()

    other_session = postgres_sessions()
    other = LiveTimerService(
        LiveTimerRepository(other_session, timer_accounts["user_ids"][1])
    )
    try:
        assert other.get_active() is None
        with pytest.raises(ValueError, match="No active timer"):
            other.pause()
        other.discard()
        with pytest.raises(ValueError, match="Finished timer not found"):
            PlayRepository(other_session, timer_accounts["user_ids"][1]).create(
                bgg_id=timer_accounts["bgg_ids"][0],
                played_at=None,
                duration_minutes=1,
                participants=[{"name": "Other", "is_winner": False}],
                timer_session_id=timer_id,
            )
    finally:
        other_session.close()

    verify_session = postgres_sessions()
    try:
        timer = verify_session.scalar(
            select(LivePlayTimer).where(LivePlayTimer.public_id == timer_id)
        )
        other_play_count = verify_session.scalar(
            select(func.count()).select_from(Play).where(
                Play.user_id == timer_accounts["user_ids"][1]
            )
        )
    finally:
        verify_session.close()

    assert timer is not None
    assert timer.user_id == timer_accounts["user_ids"][0]
    assert other_play_count == 0


def test_finished_timer_cannot_save_or_retry_against_wrong_game(
    postgres_sessions, timer_accounts
):
    session = postgres_sessions()
    timer = LiveTimerService(
        LiveTimerRepository(session, timer_accounts["user_ids"][0])
    )
    timer_id = timer.start(timer_accounts["bgg_ids"][0])["public_id"]
    timer.finish()
    repository = PlayRepository(session, timer_accounts["user_ids"][0])

    with pytest.raises(ValueError, match="Finished timer not found"):
        repository.create(
            bgg_id=timer_accounts["bgg_ids"][1],
            played_at=None,
            duration_minutes=1,
            participants=[{"name": "Alex", "is_winner": False}],
            timer_session_id=timer_id,
        )

    saved = repository.create(
        bgg_id=timer_accounts["bgg_ids"][0],
        played_at=None,
        duration_minutes=1,
        participants=[{"name": "Alex", "is_winner": False}],
        timer_session_id=timer_id,
    )

    with pytest.raises(ValueError, match="Finished timer not found"):
        repository.create(
            bgg_id=timer_accounts["bgg_ids"][1],
            played_at=None,
            duration_minutes=1,
            participants=[{"name": "Alex", "is_winner": False}],
            timer_session_id=timer_id,
        )

    assert saved.bgg_id == timer_accounts["bgg_ids"][0]
    session.close()


def test_tier_loss_does_not_delete_active_or_finished_timer(
    postgres_sessions, timer_accounts
):
    session = postgres_sessions()
    active_user_id, finished_user_id = timer_accounts["user_ids"]
    active_timer_id = LiveTimerService(
        LiveTimerRepository(session, active_user_id)
    ).start(timer_accounts["bgg_ids"][0])["public_id"]
    finished_timer_service = LiveTimerService(
        LiveTimerRepository(session, finished_user_id)
    )
    finished_timer_id = finished_timer_service.start(
        timer_accounts["bgg_ids"][0]
    )["public_id"]
    finished_timer_service.finish()
    active_user = session.get(User, active_user_id)
    finished_user = session.get(User, finished_user_id)
    active_user.tier = "FREE"
    finished_user.tier = "FREE"
    session.commit()

    timers = session.scalars(
        select(LivePlayTimer).where(
            LivePlayTimer.public_id.in_([active_timer_id, finished_timer_id])
        )
    ).all()
    assert {timer.status for timer in timers} == {"running", "finished"}

    saved = PlayRepository(session, finished_user_id).create(
        bgg_id=timer_accounts["bgg_ids"][0],
        played_at=None,
        duration_minutes=1,
        participants=[{"name": "Alex", "is_winner": False}],
        timer_session_id=finished_timer_id,
    )

    assert saved.bgg_id == timer_accounts["bgg_ids"][0]
    assert session.scalar(
        select(func.count()).select_from(LivePlayTimer).where(
            LivePlayTimer.public_id == active_timer_id
        )
    ) == 1
    session.close()
