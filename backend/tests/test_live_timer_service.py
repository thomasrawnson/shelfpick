from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database.connection import Base
from database.models import Game, User, UserGame
from repositories.live_timer_repository import LiveTimerRepository
from services.live_timer_service import LiveTimerService


class Clock:
    def __init__(self):
        self.now = datetime(2026, 9, 28, 12, 0, tzinfo=timezone.utc)

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += timedelta(seconds=seconds)


def setup_services():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    users = [User(email=f"timer-{index}@example.com", display_name="Timer", tier="PRO") for index in (1, 2)]
    game = Game(bgg_id=13, name="Cascadia", owned=True)
    session.add_all([*users, game])
    session.flush()
    session.add_all([UserGame(user_id=user.id, game_id=game.id) for user in users])
    session.commit()
    clock = Clock()
    return session, clock, [LiveTimerService(LiveTimerRepository(session, user.id), clock) for user in users]


def test_pause_resume_background_and_duplicate_actions_use_timestamps():
    session, clock, (service, _) = setup_services()
    try:
        started = service.start(13, ["Alex"], "  The   Dice Cup ")
        assert started["draft"] == {"participant_names": ["Alex"], "location": "The Dice Cup"}
        clock.advance(65)
        assert service.get_active()["elapsed_seconds"] == 65
        assert service.pause()["elapsed_seconds"] == 65
        clock.advance(300)
        assert service.pause()["elapsed_seconds"] == 65
        assert service.resume()["status"] == "running"
        assert service.resume()["status"] == "running"
        clock.advance(35)
        assert service.finish()["elapsed_seconds"] == 100
        assert service.finish()["elapsed_seconds"] == 100
    finally:
        session.close()


def test_timer_is_isolated_per_account_and_discard_cleans_only_owner():
    session, _, (first, second) = setup_services()
    try:
        first_timer = first.start(13)
        second_timer = second.start(13)
        assert first_timer["public_id"] != second_timer["public_id"]
        first.discard()
        assert first.get_active() is None
        assert second.get_active()["public_id"] == second_timer["public_id"]
    finally:
        session.close()
