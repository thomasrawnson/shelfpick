from datetime import datetime

from sqlalchemy.orm import Session

from auth.one_time_tokens import (
    BETA_EMAIL_VERIFY,
    EMAIL_VERIFY,
    PASSWORD_RESET,
)
from database.models import (
    AuthToken,
    GameNightVotingSession,
)


RETENTION_TOKEN_PURPOSES = (
    EMAIL_VERIFY,
    BETA_EMAIL_VERIFY,
    PASSWORD_RESET,
)


class RetentionRepository:
    def __init__(self, db: Session):
        self.db = db

    def count_expired_auth_tokens(
        self,
        cutoff: datetime,
    ) -> int:
        return (
            self.db.query(AuthToken)
            .filter(
                AuthToken.purpose.in_(
                    RETENTION_TOKEN_PURPOSES
                ),
                AuthToken.expires_at <= cutoff,
            )
            .count()
        )

    def count_expired_game_night_sessions(
        self,
        cutoff: datetime,
    ) -> int:
        return (
            self.db.query(
                GameNightVotingSession
            )
            .filter(
                GameNightVotingSession.expires_at
                <= cutoff
            )
            .count()
        )

    def delete_expired_auth_token_batch(
        self,
        cutoff: datetime,
        batch_size: int,
    ) -> int:
        ids = [
            token_id
            for (token_id,) in (
                self.db.query(AuthToken.id)
                .filter(
                    AuthToken.purpose.in_(
                        RETENTION_TOKEN_PURPOSES
                    ),
                    AuthToken.expires_at <= cutoff,
                )
                .order_by(
                    AuthToken.expires_at,
                    AuthToken.id,
                )
                .limit(batch_size)
                .all()
            )
        ]
        return self._delete_batch(
            AuthToken,
            ids,
        )

    def delete_expired_game_night_session_batch(
        self,
        cutoff: datetime,
        batch_size: int,
    ) -> int:
        ids = [
            session_id
            for (session_id,) in (
                self.db.query(
                    GameNightVotingSession.id
                )
                .filter(
                    GameNightVotingSession.expires_at
                    <= cutoff
                )
                .order_by(
                    GameNightVotingSession.expires_at,
                    GameNightVotingSession.id,
                )
                .limit(batch_size)
                .all()
            )
        ]
        return self._delete_batch(
            GameNightVotingSession,
            ids,
        )

    def _delete_batch(
        self,
        model,
        ids: list[int],
    ) -> int:
        if not ids:
            return 0

        try:
            deleted = (
                self.db.query(model)
                .filter(model.id.in_(ids))
                .delete(synchronize_session=False)
            )
            self.db.commit()
            return deleted
        except Exception:
            self.db.rollback()
            raise
