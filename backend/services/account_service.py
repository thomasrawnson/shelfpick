from datetime import datetime, timezone

from sqlalchemy.orm import Session

from auth.security import verify_password
from database.models import (
    AuthToken,
    GameComparison,
    GameNightBallot,
    GameNightGuest,
    GameNightVotingSession,
    GameRanking,
    LivePlayTimer,
    OperationLeaseSlot,
    PickerEvent,
    PickerSession,
    Play,
    PlayParticipant,
    Player,
    User,
    UserGame,
    UserOperationLease,
    UserWishlistGame,
)


class InvalidAccountPasswordError(ValueError):
    pass


class AccountService:
    def __init__(self, db: Session):
        self.db = db

    def delete_account(self, user: User, password: str) -> None:
        if (
            user.password_hash is None
            or not verify_password(password, user.password_hash)
        ):
            raise InvalidAccountPasswordError(
                "Password is incorrect"
            )

        try:
            # Break the circular profile-player reference before deleting the
            # user. All remaining user-owned rows use database CASCADE rules.
            user.profile_player_id = None
            user.token_version += 1
            self.db.flush()

            play_ids = self.db.query(Play.id).filter(
                Play.user_id == user.id
            )
            picker_session_ids = self.db.query(PickerSession.id).filter(
                PickerSession.user_id == user.id
            )
            voting_session_ids = self.db.query(
                GameNightVotingSession.id
            ).filter(GameNightVotingSession.host_user_id == user.id)

            self.db.query(GameNightBallot).filter(
                GameNightBallot.session_id.in_(voting_session_ids)
            ).delete(synchronize_session=False)
            self.db.query(GameNightGuest).filter(
                GameNightGuest.session_id.in_(voting_session_ids)
            ).delete(synchronize_session=False)
            self.db.query(GameNightVotingSession).filter(
                GameNightVotingSession.host_user_id == user.id
            ).delete(synchronize_session=False)
            self.db.query(OperationLeaseSlot).filter(
                OperationLeaseSlot.owner_user_id == user.id
            ).update(
                {
                    OperationLeaseSlot.owner_user_id: None,
                    OperationLeaseSlot.lease_expires_at: datetime.now(timezone.utc),
                },
                synchronize_session=False,
            )
            self.db.query(PickerEvent).filter(
                PickerEvent.picker_session_id.in_(picker_session_ids)
            ).delete(synchronize_session=False)
            self.db.query(PickerSession).filter(
                PickerSession.user_id == user.id
            ).delete(synchronize_session=False)
            self.db.query(PlayParticipant).filter(
                PlayParticipant.play_id.in_(play_ids)
            ).delete(synchronize_session=False)
            self.db.query(Play).filter(
                Play.user_id == user.id
            ).delete(synchronize_session=False)

            for model in (
                LivePlayTimer,
                GameComparison,
                GameRanking,
                UserWishlistGame,
                UserGame,
                AuthToken,
                UserOperationLease,
                Player,
            ):
                self.db.query(model).filter(
                    model.user_id == user.id
                ).delete(synchronize_session=False)

            self.db.delete(user)
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise
