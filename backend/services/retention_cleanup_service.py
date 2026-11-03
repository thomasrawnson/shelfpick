from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from repositories.retention_repository import (
    RetentionRepository,
)


AUTH_TOKEN_RETENTION_DAYS = 7
GAME_NIGHT_RETENTION_DAYS = 30
DEFAULT_BATCH_SIZE = 100
MAX_BATCH_SIZE = 500


@dataclass(frozen=True)
class RetentionCleanupResult:
    expired_auth_tokens: int
    expired_game_night_sessions: int


class RetentionCleanupService:
    def __init__(
        self,
        repository: RetentionRepository,
    ):
        self.repository = repository

    def preview(
        self,
        now: datetime | None = None,
    ) -> RetentionCleanupResult:
        token_cutoff, game_night_cutoff = (
            self._cutoffs(now)
        )
        return RetentionCleanupResult(
            expired_auth_tokens=(
                self.repository
                .count_expired_auth_tokens(
                    token_cutoff
                )
            ),
            expired_game_night_sessions=(
                self.repository
                .count_expired_game_night_sessions(
                    game_night_cutoff
                )
            ),
        )

    def apply(
        self,
        *,
        now: datetime | None = None,
        batch_size: int = DEFAULT_BATCH_SIZE,
    ) -> RetentionCleanupResult:
        if not 1 <= batch_size <= MAX_BATCH_SIZE:
            raise ValueError(
                "batch_size must be between 1 and "
                f"{MAX_BATCH_SIZE}"
            )

        token_cutoff, game_night_cutoff = (
            self._cutoffs(now)
        )
        tokens_deleted = self._delete_all_batches(
            lambda: (
                self.repository
                .delete_expired_auth_token_batch(
                    token_cutoff,
                    batch_size,
                )
            )
        )
        sessions_deleted = self._delete_all_batches(
            lambda: (
                self.repository
                .delete_expired_game_night_session_batch(
                    game_night_cutoff,
                    batch_size,
                )
            )
        )
        return RetentionCleanupResult(
            expired_auth_tokens=tokens_deleted,
            expired_game_night_sessions=(
                sessions_deleted
            ),
        )

    @staticmethod
    def _delete_all_batches(delete_batch) -> int:
        total = 0
        while True:
            deleted = delete_batch()
            total += deleted
            if deleted == 0:
                return total

    @staticmethod
    def _cutoffs(
        now: datetime | None,
    ) -> tuple[datetime, datetime]:
        reference = now or datetime.now(
            timezone.utc
        )
        if reference.tzinfo is None:
            raise ValueError(
                "now must be timezone-aware"
            )
        return (
            reference - timedelta(
                days=AUTH_TOKEN_RETENTION_DAYS
            ),
            reference - timedelta(
                days=GAME_NIGHT_RETENTION_DAYS
            ),
        )
