import os
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from auth.security import create_access_token, decode_access_token
from database.connection import Base
from database.models import (
    AuthToken,
    GameNightBallot,
    GameNightGuest,
    GameNightVotingSession,
    User,
)
from repositories.retention_repository import RetentionRepository
from services.retention_cleanup_service import RetentionCleanupService


DATABASE_URL = os.getenv("RETENTION_TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not DATABASE_URL,
    reason="requires an isolated PostgreSQL RETENTION_TEST_DATABASE_URL",
)


@pytest.fixture(scope="module")
def postgres_sessions():
    parsed = urlparse(
        DATABASE_URL.replace(
            "postgresql+psycopg://",
            "postgresql://",
            1,
        )
    )
    if "test" not in parsed.path.casefold():
        pytest.fail(
            "RETENTION_TEST_DATABASE_URL must name an isolated test database"
        )

    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    try:
        yield sessions
    finally:
        Base.metadata.drop_all(engine)
        engine.dispose()


def add_user(session, email: str) -> User:
    user = User(
        email=email,
        display_name=email.split("@", 1)[0],
        password_hash="not-a-real-hash",
        tier="FREE",
    )
    session.add(user)
    session.flush()
    return user


def add_voting_session(
    session,
    user: User,
    *,
    suffix: str,
    expires_at: datetime,
) -> tuple[GameNightVotingSession, GameNightGuest, GameNightBallot]:
    voting = GameNightVotingSession(
        public_id=f"retention-{suffix}",
        join_token_hash=f"join-{suffix}",
        host_user_id=user.id,
        status="open",
        candidates=[],
        expires_at=expires_at,
    )
    session.add(voting)
    session.flush()
    guest = GameNightGuest(
        public_id=f"guest-{suffix}",
        session_id=voting.id,
        credential_hash=f"credential-{suffix}",
        display_name=f"Guest {suffix}",
    )
    session.add(guest)
    session.flush()
    ballot = GameNightBallot(
        session_id=voting.id,
        guest_id=guest.id,
        candidate_bgg_id=None,
    )
    session.add(ballot)
    session.flush()
    return voting, guest, ballot


def test_postgres_cleanup_is_bounded_idempotent_and_credential_safe(
    postgres_sessions,
):
    now = datetime(2026, 11, 3, 12, tzinfo=timezone.utc)
    session = postgres_sessions()
    owner = add_user(session, "retention-owner@example.com")
    other = add_user(session, "retention-other@example.com")
    access_token = create_access_token(owner.id, owner.token_version)

    expired_tokens = [
        AuthToken(
            user_id=owner.id,
            token_hash=character * 64,
            purpose="email_verify",
            expires_at=now - timedelta(days=7, seconds=index),
        )
        for index, character in enumerate(("a", "b"))
    ]
    active_token = AuthToken(
        user_id=other.id,
        token_hash="c" * 64,
        purpose="password_reset",
        expires_at=now - timedelta(days=7) + timedelta(seconds=1),
    )
    unrelated_token = AuthToken(
        user_id=owner.id,
        token_hash="d" * 64,
        purpose="future_credential",
        expires_at=now - timedelta(days=90),
    )
    session.add_all([*expired_tokens, active_token, unrelated_token])

    old_voting, old_guest, old_ballot = add_voting_session(
        session,
        owner,
        suffix="old",
        expires_at=now - timedelta(days=30),
    )
    current_voting, current_guest, current_ballot = add_voting_session(
        session,
        other,
        suffix="current",
        expires_at=now - timedelta(days=30) + timedelta(seconds=1),
    )
    session.commit()
    ids = {
        "owner": owner.id,
        "other": other.id,
        "expired_tokens": [token.id for token in expired_tokens],
        "active_token": active_token.id,
        "unrelated_token": unrelated_token.id,
        "old_voting": old_voting.id,
        "old_guest": old_guest.id,
        "old_ballot": old_ballot.id,
        "current_voting": current_voting.id,
        "current_guest": current_guest.id,
        "current_ballot": current_ballot.id,
    }

    service = RetentionCleanupService(RetentionRepository(session))
    preview = service.preview(now)
    assert preview.expired_auth_tokens == 2
    assert preview.expired_game_night_sessions == 1
    assert session.get(AuthToken, ids["expired_tokens"][0]) is not None

    result = service.apply(now=now, batch_size=1)
    assert result.expired_auth_tokens == 2
    assert result.expired_game_night_sessions == 1
    repeated = service.apply(now=now, batch_size=1)
    assert repeated.expired_auth_tokens == 0
    assert repeated.expired_game_night_sessions == 0
    session.close()

    check = postgres_sessions()
    try:
        assert all(
            check.get(AuthToken, token_id) is None
            for token_id in ids["expired_tokens"]
        )
        assert check.get(AuthToken, ids["active_token"]) is not None
        assert check.get(AuthToken, ids["unrelated_token"]) is not None
        assert check.get(GameNightVotingSession, ids["old_voting"]) is None
        assert check.get(GameNightGuest, ids["old_guest"]) is None
        assert check.get(GameNightBallot, ids["old_ballot"]) is None
        assert check.get(GameNightVotingSession, ids["current_voting"]) is not None
        assert check.get(GameNightGuest, ids["current_guest"]) is not None
        assert check.get(GameNightBallot, ids["current_ballot"]) is not None
        assert check.get(User, ids["owner"]).token_version == 0
        assert check.get(User, ids["other"]) is not None
        assert decode_access_token(access_token) == (ids["owner"], 0)
    finally:
        check.close()


def test_postgres_cleanup_rolls_back_a_failed_batch(
    postgres_sessions,
):
    now = datetime(2026, 11, 3, 12, tzinfo=timezone.utc)
    session = postgres_sessions()
    user = add_user(session, "retention-rollback@example.com")
    token = AuthToken(
        user_id=user.id,
        token_hash="e" * 64,
        purpose="password_reset",
        expires_at=now - timedelta(days=8),
    )
    session.add(token)
    session.commit()
    token_id = token.id

    def fail_commit(_session):
        raise RuntimeError("simulated commit failure")

    event.listen(session, "before_commit", fail_commit)
    try:
        with pytest.raises(RuntimeError, match="simulated commit failure"):
            RetentionRepository(session).delete_expired_auth_token_batch(
                now - timedelta(days=7),
                1,
            )
    finally:
        event.remove(session, "before_commit", fail_commit)

    check = postgres_sessions()
    try:
        assert check.get(AuthToken, token_id) is not None
    finally:
        check.close()
        session.close()
