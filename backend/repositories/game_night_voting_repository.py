from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database.models import (
    GameNightBallot,
    GameNightGuest,
    GameNightVotingSession,
)


class GameNightVotingRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_session(self, session: GameNightVotingSession) -> GameNightVotingSession:
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_for_host(
        self, public_id: str, host_user_id: int,
    ) -> GameNightVotingSession | None:
        return (
            self.db.query(GameNightVotingSession)
            .filter(
                GameNightVotingSession.public_id == public_id,
                GameNightVotingSession.host_user_id == host_user_id,
            )
            .first()
        )

    def get_by_join_hash(self, token_hash: str) -> GameNightVotingSession | None:
        return (
            self.db.query(GameNightVotingSession)
            .filter(GameNightVotingSession.join_token_hash == token_hash)
            .first()
        )

    def lock_session(self, session_id: int) -> GameNightVotingSession:
        return (
            self.db.query(GameNightVotingSession)
            .filter(GameNightVotingSession.id == session_id)
            .with_for_update()
            .one()
        )

    def save_session(self, session: GameNightVotingSession) -> None:
        self.db.commit()
        self.db.refresh(session)

    def guest_count(self, session_id: int) -> int:
        return (
            self.db.query(GameNightGuest)
            .filter(GameNightGuest.session_id == session_id)
            .count()
        )

    def create_guest(self, guest: GameNightGuest) -> GameNightGuest:
        self.db.add(guest)
        self.db.commit()
        self.db.refresh(guest)
        return guest

    def get_guest(
        self, session_id: int, credential_hash: str,
    ) -> GameNightGuest | None:
        return (
            self.db.query(GameNightGuest)
            .filter(
                GameNightGuest.session_id == session_id,
                GameNightGuest.credential_hash == credential_hash,
            )
            .first()
        )

    def guest_names(self, session_id: int) -> list[str]:
        return [
            name
            for (name,) in (
                self.db.query(GameNightGuest.display_name)
                .filter(GameNightGuest.session_id == session_id)
                .order_by(GameNightGuest.created_at, GameNightGuest.id)
                .all()
            )
        ]

    def get_ballot(self, guest_id: int) -> GameNightBallot | None:
        return (
            self.db.query(GameNightBallot)
            .filter(GameNightBallot.guest_id == guest_id)
            .first()
        )

    def set_ballot(
        self,
        session_id: int,
        guest_id: int,
        candidate_bgg_id: int | None,
    ) -> GameNightBallot:
        ballot = self.get_ballot(guest_id)
        if ballot is None:
            ballot = GameNightBallot(
                session_id=session_id,
                guest_id=guest_id,
                candidate_bgg_id=candidate_bgg_id,
            )
            self.db.add(ballot)
        else:
            ballot.candidate_bgg_id = candidate_bgg_id

        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            ballot = self.get_ballot(guest_id)
            if ballot is None:
                raise
            ballot.candidate_bgg_id = candidate_bgg_id
            self.db.commit()

        self.db.refresh(ballot)
        return ballot

    def ballots(self, session_id: int) -> list[GameNightBallot]:
        return (
            self.db.query(GameNightBallot)
            .filter(GameNightBallot.session_id == session_id)
            .all()
        )
