import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from urllib.parse import urlparse

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from auth.login_rate_limiter import DatabaseAuthRateLimiter
from auth.one_time_tokens import PASSWORD_RESET, create_one_time_token
from auth.security import hash_password
from database.connection import Base
from database.models import (
    Game,
    GameNightBallot,
    GameNightGuest,
    GameNightVotingSession,
    PickerEvent,
    PickerSession,
    Play,
    PlayParticipant,
    Player,
    User,
    UserGame,
    AuthToken,
    UserOperationLease,
)
from services.account_service import AccountService
from services.workload_limits import (
    GlobalOperationGuard,
    OperationCapacityError,
    OperationInProgressError,
    UserOperationGuard,
)


DATABASE_URL = os.getenv("LAUNCH_HARDENING_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not DATABASE_URL,
    reason="requires an isolated PostgreSQL LAUNCH_HARDENING_DATABASE_URL",
)


@pytest.fixture(scope="module")
def postgres_sessions():
    parsed = urlparse(DATABASE_URL.replace("postgresql+psycopg://", "postgresql://", 1))
    if "test" not in parsed.path.casefold():
        pytest.fail("LAUNCH_HARDENING_DATABASE_URL must name an isolated test database")
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    try:
        yield sessions
    finally:
        Base.metadata.drop_all(engine)
        engine.dispose()


def create_user(sessions, email):
    session = sessions()
    user = User(
        email=email,
        tier="FREE",
        password_hash=hash_password("password123"),
        email_verified_at=datetime.now(timezone.utc),
    )
    session.add(user)
    session.commit()
    user_id = user.id
    session.close()
    return user_id


def test_rate_limit_is_shared_across_concurrent_sessions(postgres_sessions):
    barrier = Barrier(2)

    def record():
        session = postgres_sessions()
        try:
            barrier.wait()
            return DatabaseAuthRateLimiter(session).check_and_record(
                "concurrent-login", "same@example.com", 1, 900
            )
        finally:
            session.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: record(), range(2)))

    assert sorted(results) == [False, True]


def test_collection_lease_allows_only_one_concurrent_sync(postgres_sessions):
    user_id = create_user(postgres_sessions, "lease-postgres@example.com")
    barrier = Barrier(2)

    def acquire():
        session = postgres_sessions()
        try:
            barrier.wait()
            UserOperationGuard(
                session, user_id, "collection-sync", 300, 900
            ).acquire()
            return "acquired"
        except OperationInProgressError:
            return "blocked"
        finally:
            session.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: acquire(), range(2)))

    assert sorted(results) == ["acquired", "blocked"]


def test_global_collection_capacity_allows_two_concurrent_syncs(postgres_sessions):
    user_ids = [
        create_user(postgres_sessions, f"capacity-{index}@example.com")
        for index in range(3)
    ]
    barrier = Barrier(3)

    def acquire(user_id):
        session = postgres_sessions()
        try:
            barrier.wait()
            GlobalOperationGuard(
                session, user_id, "collection-sync", 900
            ).acquire()
            return "acquired"
        except OperationCapacityError:
            return "blocked"
        finally:
            session.close()

    with ThreadPoolExecutor(max_workers=3) as executor:
        results = list(executor.map(acquire, user_ids))

    assert sorted(results) == ["acquired", "acquired", "blocked"]


def test_stale_lease_owner_cannot_release_successor(postgres_sessions):
    user_id = create_user(postgres_sessions, "lease-generation@example.com")
    first_session = postgres_sessions()
    first = UserOperationGuard(first_session, user_id, "generation", 0, 900)
    first.acquire()

    expiry_session = postgres_sessions()
    lease = expiry_session.query(UserOperationLease).filter_by(
        user_id=user_id, operation="generation"
    ).one()
    lease.lease_expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    expiry_session.commit()
    expiry_session.close()

    second_session = postgres_sessions()
    second = UserOperationGuard(second_session, user_id, "generation", 0, 900)
    second.acquire()
    successor_token = second.lease_token

    first.release()
    check_session = postgres_sessions()
    current = check_session.query(UserOperationLease).filter_by(
        user_id=user_id, operation="generation"
    ).one()
    assert current.lease_token == successor_token
    assert current.lease_expires_at > datetime.now(timezone.utc)
    check_session.close()
    first_session.close()
    second.release()
    second_session.close()


def test_concurrent_reset_requests_leave_one_active_token(postgres_sessions):
    user_id = create_user(postgres_sessions, "token-lock@example.com")
    barrier = Barrier(2)

    def issue():
        session = postgres_sessions()
        try:
            barrier.wait()
            create_one_time_token(session, user_id, PASSWORD_RESET)
        finally:
            session.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        list(executor.map(lambda _: issue(), range(2)))

    session = postgres_sessions()
    assert session.query(AuthToken).filter_by(
        user_id=user_id, purpose=PASSWORD_RESET, used_at=None
    ).count() == 1
    session.close()


def test_account_deletion_cascades_owned_graph_but_preserves_shared_game(
    postgres_sessions,
):
    session = postgres_sessions()
    owner = User(
        email="delete-postgres@example.com",
        tier="FREE",
        password_hash=hash_password("password123"),
        email_verified_at=datetime.now(timezone.utc),
    )
    other = User(email="survivor-postgres@example.com", tier="FREE")
    game = Game(bgg_id=990001, name="Shared", owned=False)
    session.add_all([owner, other, game])
    session.flush()
    player = Player(user_id=owner.id, name="Owner", normalized_name="owner")
    play = Play(user_id=owner.id, game_id=game.id, player_count=1, source="app")
    picker = PickerSession(
        public_id="postgres-picker",
        user_id=owner.id,
        criteria={},
        recommendation_bgg_ids=[game.bgg_id],
    )
    voting = GameNightVotingSession(
        public_id="postgres-vote",
        join_token_hash="postgres-vote-hash",
        host_user_id=owner.id,
        status="open",
        candidates=[],
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    session.add_all([player, play, picker, voting])
    session.flush()
    guest = GameNightGuest(
        public_id="postgres-guest",
        session_id=voting.id,
        credential_hash="postgres-guest-hash",
        display_name="Guest",
    )
    session.add(guest)
    session.flush()
    session.add_all([
        UserGame(user_id=owner.id, game_id=game.id),
        UserGame(user_id=other.id, game_id=game.id),
        PlayParticipant(
            play_id=play.id,
            player_id=player.id,
            name="Owner",
            is_winner=True,
        ),
        PickerEvent(picker_session_id=picker.id, event_type="shown"),
        GameNightBallot(
            session_id=voting.id,
            guest_id=guest.id,
            candidate_bgg_id=game.bgg_id,
        ),
    ])
    session.commit()
    owner_id = owner.id
    other_id = other.id

    AccountService(session).delete_account(owner, "password123")

    assert session.get(User, owner_id) is None
    assert session.get(User, other_id) is not None
    assert session.query(Game).filter(Game.bgg_id == game.bgg_id).count() == 1
    assert session.query(UserGame).filter(UserGame.user_id == other_id).count() == 1
    assert session.query(PlayParticipant).count() == 0
    assert session.query(PickerEvent).count() == 0
    assert session.query(GameNightGuest).count() == 0
    assert session.query(GameNightBallot).count() == 0
    session.close()
