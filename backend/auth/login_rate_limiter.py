from collections import (
    defaultdict,
    deque,
)
from threading import Lock
import time
from datetime import datetime, timedelta, timezone
import hashlib
import hmac

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config import settings
from database.models import AuthRateLimit


MAX_LOGIN_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 15 * 60
MAX_AUTH_REQUESTS = 5
AUTH_REQUEST_WINDOW_SECONDS = 15 * 60
AUTH_RATE_LIMIT_RETENTION_SECONDS = 24 * 60 * 60


class DatabaseAuthRateLimiter:
    """A process-independent fixed-window limiter stored in PostgreSQL.

    Raw email addresses and client addresses are never persisted. Expired
    rows are deleted on writes so attacker-controlled keys cannot grow the
    table without a time bound.
    """

    def __init__(self, db: Session):
        self.db = db

    def check_and_record(
        self,
        scope: str,
        identity: str,
        max_requests: int,
        window_seconds: int,
    ) -> bool:
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(seconds=window_seconds)
        stale_cutoff = now - timedelta(
            seconds=AUTH_RATE_LIMIT_RETENTION_SECONDS
        )
        key_hash = self._key_hash(scope, identity)

        self.db.query(AuthRateLimit).filter(
            AuthRateLimit.updated_at < stale_cutoff
        ).delete(synchronize_session=False)

        row = (
            self.db.query(AuthRateLimit)
            .filter(
                AuthRateLimit.scope == scope,
                AuthRateLimit.key_hash == key_hash,
            )
            .with_for_update()
            .first()
        )

        if row is None:
            try:
                with self.db.begin_nested():
                    row = AuthRateLimit(
                        scope=scope,
                        key_hash=key_hash,
                        window_started_at=now,
                        request_count=1,
                        updated_at=now,
                    )
                    self.db.add(row)
                    self.db.flush()
            except IntegrityError:
                row = (
                    self.db.query(AuthRateLimit)
                    .filter(
                        AuthRateLimit.scope == scope,
                        AuthRateLimit.key_hash == key_hash,
                    )
                    .with_for_update()
                    .one()
                )
                self._increment(row, now, cutoff)
        else:
            self._increment(row, now, cutoff)

        limited = row.request_count > max_requests
        self.db.commit()
        return limited

    def reset(self, scope: str, identity: str) -> None:
        self.db.query(AuthRateLimit).filter(
            AuthRateLimit.scope == scope,
            AuthRateLimit.key_hash == self._key_hash(scope, identity),
        ).delete(synchronize_session=False)
        self.db.commit()

    @staticmethod
    def _increment(
        row: AuthRateLimit,
        now: datetime,
        cutoff: datetime,
    ) -> None:
        started = row.window_started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        if started <= cutoff:
            row.window_started_at = now
            row.request_count = 1
        else:
            row.request_count += 1
        row.updated_at = now

    @staticmethod
    def _key_hash(scope: str, identity: str) -> str:
        return hmac.new(
            settings.jwt_secret.encode("utf-8"),
            f"{scope}:{identity}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()


class LoginRateLimiter:
    def __init__(self):
        self._attempts: dict[
            str,
            deque[float],
        ] = defaultdict(deque)

        self._lock = Lock()


    def is_limited(
        self,
        key: str,
    ) -> bool:
        with self._lock:
            attempts = self._attempts[
                key
            ]

            self._prune(
                attempts
            )

            return (
                len(attempts)
                >= MAX_LOGIN_ATTEMPTS
            )


    def record_failure(
        self,
        key: str,
    ) -> None:
        with self._lock:
            attempts = self._attempts[
                key
            ]

            self._prune(
                attempts
            )

            attempts.append(
                time.monotonic()
            )


    def reset(
        self,
        key: str,
    ) -> None:
        with self._lock:
            self._attempts.pop(
                key,
                None,
            )


    def clear(
        self,
    ) -> None:
        with self._lock:
            self._attempts.clear()


    @staticmethod
    def _prune(
        attempts: deque[float],
    ) -> None:
        cutoff = (
            time.monotonic()
            - LOGIN_WINDOW_SECONDS
        )

        while (
            attempts
            and attempts[0]
            <= cutoff
        ):
            attempts.popleft()


login_rate_limiter = (
    LoginRateLimiter()
)


class AuthRequestRateLimiter:
    def __init__(
        self,
        max_requests: int = MAX_AUTH_REQUESTS,
        window_seconds: int = AUTH_REQUEST_WINDOW_SECONDS,
    ):
        self._requests: dict[
            str,
            deque[float],
        ] = defaultdict(deque)

        self._lock = Lock()
        self.max_requests = max_requests
        self.window_seconds = window_seconds


    def is_limited(
        self,
        key: str,
    ) -> bool:
        with self._lock:
            requests = self._requests[
                key
            ]

            self._prune(
                requests
            )

            return (
                len(requests)
                >= self.max_requests
            )


    def record_request(
        self,
        key: str,
    ) -> None:
        with self._lock:
            requests = self._requests[
                key
            ]

            self._prune(
                requests
            )

            requests.append(
                time.monotonic()
            )


    def clear(
        self,
    ) -> None:
        with self._lock:
            self._requests.clear()


    def _prune(
        self,
        requests: deque[float],
    ) -> None:
        cutoff = (
            time.monotonic()
            - self.window_seconds
        )

        while (
            requests
            and requests[0]
            <= cutoff
        ):
            requests.popleft()


verification_request_rate_limiter = (
    AuthRequestRateLimiter()
)

password_reset_request_rate_limiter = (
    AuthRequestRateLimiter()
)

game_night_join_rate_limiter = (
    AuthRequestRateLimiter(
        max_requests=30,
        window_seconds=15 * 60,
    )
)
