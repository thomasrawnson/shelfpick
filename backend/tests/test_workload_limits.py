from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database.connection import Base
from database.models import User, UserOperationLease
from services.workload_limits import (
    GlobalOperationGuard,
    OperationCapacityError,
    OperationCooldownError,
    OperationInProgressError,
    UserOperationGuard,
)


@pytest.fixture
def guard_context():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    user = User(email="lease@example.com", tier="FREE")
    session.add(user)
    session.commit()
    try:
        yield session, user.id
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def make_guard(session, user_id):
    return UserOperationGuard(
        session,
        user_id,
        "collection-sync",
        cooldown_seconds=300,
        lease_seconds=900,
    )


def test_active_lease_blocks_overlapping_sync(guard_context):
    session, user_id = guard_context
    make_guard(session, user_id).acquire()

    with pytest.raises(OperationInProgressError):
        make_guard(session, user_id).acquire()


def test_completed_sync_enforces_cooldown(guard_context):
    session, user_id = guard_context
    guard = make_guard(session, user_id)
    guard.acquire()
    guard.release()

    with pytest.raises(OperationCooldownError):
        make_guard(session, user_id).acquire()


def test_expired_cooldown_can_be_reacquired(guard_context):
    session, user_id = guard_context
    now = datetime.now(timezone.utc)
    session.add(UserOperationLease(
        user_id=user_id,
        operation="collection-sync",
        started_at=now - timedelta(minutes=10),
        lease_expires_at=now - timedelta(minutes=9),
    ))
    session.commit()

    make_guard(session, user_id).acquire()

    row = session.query(UserOperationLease).one()
    started_at = row.started_at
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    assert started_at > now - timedelta(seconds=5)


def test_global_sync_capacity_is_bounded_to_two_slots(guard_context):
    session, user_id = guard_context
    first = GlobalOperationGuard(session, user_id, "collection-sync", 900)
    second = GlobalOperationGuard(session, user_id, "collection-sync", 900)
    first.acquire()
    second.acquire()

    with pytest.raises(OperationCapacityError):
        GlobalOperationGuard(session, user_id, "collection-sync", 900).acquire()

    first.release()
    GlobalOperationGuard(session, user_id, "collection-sync", 900).acquire()
