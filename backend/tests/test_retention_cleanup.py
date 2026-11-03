from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from database.connection import Base
from database.models import (
    AuthToken,
    GameNightBallot,
    GameNightGuest,
    GameNightVotingSession,
    User,
)
from repositories.retention_repository import (
    RetentionRepository,
)
from scripts.retention_cleanup import (
    cleanup_apply_enabled,
)
from services.retention_cleanup_service import (
    RetentionCleanupService,
)


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite:///:memory:"
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(
        connection,
        _connection_record,
    ):
        connection.execute(
            "PRAGMA foreign_keys=ON"
        )

    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


def add_user(db, email: str) -> User:
    user = User(
        email=email,
        display_name=email.split("@", 1)[0],
        password_hash="not-a-real-hash",
        tier="FREE",
    )
    db.add(user)
    db.flush()
    return user


def add_voting_session(
    db,
    user: User,
    *,
    suffix: str,
    expires_at: datetime,
) -> tuple[
    GameNightVotingSession,
    GameNightGuest,
    GameNightBallot,
]:
    session = GameNightVotingSession(
        public_id=f"session-{suffix}",
        join_token_hash=f"join-{suffix}",
        host_user_id=user.id,
        status="open",
        candidates=[],
        expires_at=expires_at,
    )
    db.add(session)
    db.flush()
    guest = GameNightGuest(
        public_id=f"guest-{suffix}",
        session_id=session.id,
        credential_hash=f"credential-{suffix}",
        display_name=f"Guest {suffix}",
    )
    db.add(guest)
    db.flush()
    ballot = GameNightBallot(
        session_id=session.id,
        guest_id=guest.id,
        candidate_bgg_id=None,
    )
    db.add(ballot)
    db.flush()
    return session, guest, ballot


def test_cleanup_is_bounded_idempotent_and_user_scoped(
    db,
):
    now = datetime(
        2026, 11, 3, 12,
        tzinfo=timezone.utc,
    )
    old_user = add_user(
        db,
        "old@example.com",
    )
    current_user = add_user(
        db,
        "current@example.com",
    )

    expired_token = AuthToken(
        user_id=old_user.id,
        token_hash="a" * 64,
        purpose="email_verify",
        expires_at=now - timedelta(days=7),
    )
    current_token = AuthToken(
        user_id=current_user.id,
        token_hash="b" * 64,
        purpose="password_reset",
        expires_at=(
            now
            - timedelta(days=7)
            + timedelta(seconds=1)
        ),
    )
    db.add_all([
        expired_token,
        current_token,
    ])

    old_session, old_guest, old_ballot = (
        add_voting_session(
            db,
            old_user,
            suffix="old",
            expires_at=(
                now - timedelta(days=30)
            ),
        )
    )
    current_session, current_guest, current_ballot = (
        add_voting_session(
            db,
            current_user,
            suffix="current",
            expires_at=(
                now
                - timedelta(days=30)
                + timedelta(seconds=1)
            ),
        )
    )
    db.commit()
    ids = {
        "expired_token": expired_token.id,
        "current_token": current_token.id,
        "old_session": old_session.id,
        "old_guest": old_guest.id,
        "old_ballot": old_ballot.id,
        "current_session": current_session.id,
        "current_guest": current_guest.id,
        "current_ballot": current_ballot.id,
    }

    service = RetentionCleanupService(
        RetentionRepository(db)
    )
    preview = service.preview(now)
    assert preview.expired_auth_tokens == 1
    assert preview.expired_game_night_sessions == 1

    result = service.apply(
        now=now,
        batch_size=1,
    )
    assert result.expired_auth_tokens == 1
    assert result.expired_game_night_sessions == 1
    assert db.get(
        AuthToken,
        ids["expired_token"],
    ) is None
    assert db.get(
        GameNightVotingSession,
        ids["old_session"],
    ) is None
    assert db.get(
        GameNightGuest,
        ids["old_guest"],
    ) is None
    assert db.get(
        GameNightBallot,
        ids["old_ballot"],
    ) is None

    assert db.get(
        AuthToken,
        ids["current_token"],
    ) is not None
    assert db.get(
        GameNightVotingSession,
        ids["current_session"],
    ) is not None
    assert db.get(
        GameNightGuest,
        ids["current_guest"],
    ) is not None
    assert db.get(
        GameNightBallot,
        ids["current_ballot"],
    ) is not None
    assert db.get(User, old_user.id) is not None
    assert db.get(User, current_user.id) is not None

    repeated = service.apply(
        now=now,
        batch_size=1,
    )
    assert repeated.expired_auth_tokens == 0
    assert repeated.expired_game_night_sessions == 0


def test_cleanup_rejects_unsafe_boundaries(db):
    service = RetentionCleanupService(
        RetentionRepository(db)
    )
    with pytest.raises(
        ValueError,
        match="timezone-aware",
    ):
        service.preview(
            datetime(2026, 11, 3)
        )
    with pytest.raises(
        ValueError,
        match="batch_size",
    ):
        service.apply(batch_size=0)
    with pytest.raises(
        ValueError,
        match="batch_size",
    ):
        service.apply(batch_size=501)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (None, False),
        ("", False),
        ("false", False),
        ("1", False),
        ("true", True),
        (" TRUE ", True),
    ],
)
def test_cleanup_apply_gate_fails_closed(
    value,
    expected,
):
    assert cleanup_apply_enabled(value) is expected
