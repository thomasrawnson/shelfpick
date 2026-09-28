from datetime import datetime, timedelta, timezone
from hashlib import sha256
import secrets
from uuid import uuid4

from database.models import Game, GameNightGuest, GameNightVotingSession
from repositories.game_night_voting_repository import GameNightVotingRepository


MAX_GAME_NIGHT_GUESTS = 20
GAME_NIGHT_SESSION_HOURS = 12


class VotingNotFoundError(ValueError):
    pass


class VotingExpiredError(ValueError):
    pass


class VotingClosedError(ValueError):
    pass


def token_hash(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


class GameNightVotingService:
    def __init__(self, repository: GameNightVotingRepository):
        self.repository = repository

    def open_session(
        self,
        host_user_id: int,
        candidate_bgg_ids: list[int],
        games: list[Game],
        app_origin: str,
    ) -> dict:
        if len(candidate_bgg_ids) < 3 or len(candidate_bgg_ids) > 5:
            raise ValueError("Choose between 3 and 5 shortlisted games.")
        if len(candidate_bgg_ids) != len(set(candidate_bgg_ids)):
            raise ValueError("Shortlisted games must be unique.")

        games_by_id = {
            game.bgg_id: game
            for game in games
            if game.owned and not game.is_expansion
        }
        if any(bgg_id not in games_by_id for bgg_id in candidate_bgg_ids):
            raise ValueError("The shortlist contains an unavailable game.")

        join_token = secrets.token_urlsafe(32)
        now = datetime.now(timezone.utc)
        session = self.repository.create_session(
            GameNightVotingSession(
                public_id=str(uuid4()),
                join_token_hash=token_hash(join_token),
                host_user_id=host_user_id,
                status="open",
                candidates=[
                    {
                        "bgg_id": game.bgg_id,
                        "name": game.name,
                        "thumbnail_url": game.thumbnail_url,
                    }
                    for game in (games_by_id[bgg_id] for bgg_id in candidate_bgg_ids)
                ],
                expires_at=now + timedelta(hours=GAME_NIGHT_SESSION_HOURS),
            )
        )
        response = self.host_state(session)
        response["join_url"] = (
            f"{app_origin.rstrip('/')}/game-night/join/{join_token}"
        )
        return response

    def host_session(self, public_id: str, host_user_id: int) -> dict:
        session = self.repository.get_for_host(public_id, host_user_id)
        if session is None:
            raise VotingNotFoundError("Voting session not found.")
        return self.host_state(session)

    def close(self, public_id: str, host_user_id: int) -> dict:
        session = self.repository.get_for_host(public_id, host_user_id)
        if session is None:
            raise VotingNotFoundError("Voting session not found.")
        session = self.repository.lock_session(session.id)
        if self._is_expired(session):
            raise VotingExpiredError("This voting session has expired.")
        if session.status == "open":
            session.status = "closed"
            session.closed_at = datetime.now(timezone.utc)
            self.repository.save_session(session)
        return self.host_state(session)

    def public_session(
        self, join_token: str, guest_credential: str | None = None,
    ) -> dict:
        session = self._session_for_token(join_token)
        guest = self._guest_for_credential(session, guest_credential)
        return self.public_state(session, guest)

    def join(self, join_token: str, display_name: str) -> tuple[dict, str]:
        session = self._open_session_for_token(join_token)
        display_name = " ".join(display_name.split())
        if not display_name:
            raise ValueError("Enter a display name.")
        if len(display_name) > 40:
            raise ValueError("Display name must be 40 characters or fewer.")

        session = self.repository.lock_session(session.id)
        self._require_open(session)
        if self.repository.guest_count(session.id) >= MAX_GAME_NIGHT_GUESTS:
            self.repository.db.rollback()
            raise ValueError("This voting session is full.")

        credential = secrets.token_urlsafe(32)
        guest = self.repository.create_guest(
            GameNightGuest(
                public_id=str(uuid4()),
                session_id=session.id,
                credential_hash=token_hash(credential),
                display_name=display_name,
            )
        )
        return self.public_state(session, guest), credential

    def vote(
        self,
        join_token: str,
        guest_credential: str | None,
        candidate_bgg_id: int | None,
    ) -> dict:
        session = self._open_session_for_token(join_token)
        session = self.repository.lock_session(session.id)
        self._require_open(session)
        guest = self._guest_for_credential(session, guest_credential)
        if guest is None:
            raise VotingNotFoundError("Join this session before voting.")

        candidate_ids = {
            int(candidate["bgg_id"])
            for candidate in session.candidates
        }
        if candidate_bgg_id is not None and candidate_bgg_id not in candidate_ids:
            raise ValueError("That game is not in this voting session.")

        self.repository.set_ballot(
            session.id,
            guest.id,
            candidate_bgg_id,
        )
        return self.public_state(session, guest)

    def host_state(self, session: GameNightVotingSession) -> dict:
        ballots = self.repository.ballots(session.id)
        status = "expired" if self._is_expired(session) else session.status
        return {
            "session_id": session.public_id,
            "status": status,
            "expires_at": session.expires_at,
            "candidates": session.candidates,
            "participant_count": self.repository.guest_count(session.id),
            "ballots_submitted": len(ballots),
            "participant_names": self.repository.guest_names(session.id),
            "results": self._results(session, ballots) if status == "closed" else None,
        }

    def public_state(
        self,
        session: GameNightVotingSession,
        guest: GameNightGuest | None,
    ) -> dict:
        ballots = self.repository.ballots(session.id)
        ballot = self.repository.get_ballot(guest.id) if guest else None
        return {
            "status": session.status,
            "candidates": session.candidates,
            "participant_count": self.repository.guest_count(session.id),
            "ballots_submitted": len(ballots),
            "guest": (
                {
                    "display_name": guest.display_name,
                    "current_vote": ballot.candidate_bgg_id if ballot else None,
                    "has_submitted": ballot is not None,
                }
                if guest else None
            ),
            "results": self._results(session, ballots) if session.status == "closed" else None,
        }

    def _session_for_token(self, join_token: str) -> GameNightVotingSession:
        session = self.repository.get_by_join_hash(token_hash(join_token))
        if session is None:
            raise VotingNotFoundError("This voting link isn't valid.")
        if self._is_expired(session):
            raise VotingExpiredError("This voting session has expired.")
        return session

    def _open_session_for_token(self, join_token: str) -> GameNightVotingSession:
        session = self._session_for_token(join_token)
        self._require_open(session)
        return session

    def _require_open(self, session: GameNightVotingSession) -> None:
        if self._is_expired(session):
            raise VotingExpiredError("This voting session has expired.")
        if session.status != "open":
            raise VotingClosedError("Voting is closed.")

    def _guest_for_credential(
        self,
        session: GameNightVotingSession,
        credential: str | None,
    ) -> GameNightGuest | None:
        if not credential:
            return None
        return self.repository.get_guest(session.id, token_hash(credential))

    @staticmethod
    def _is_expired(session: GameNightVotingSession) -> bool:
        expires_at = session.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc) >= expires_at

    @staticmethod
    def _results(session: GameNightVotingSession, ballots: list) -> dict:
        counts = {
            int(candidate["bgg_id"]): 0
            for candidate in session.candidates
        }
        abstain_count = 0
        for ballot in ballots:
            if ballot.candidate_bgg_id is None:
                abstain_count += 1
            elif ballot.candidate_bgg_id in counts:
                counts[ballot.candidate_bgg_id] += 1

        highest = max(counts.values(), default=0)
        winner_ids = (
            [bgg_id for bgg_id, count in counts.items() if count == highest]
            if highest > 0 else []
        )
        return {
            "counts": [
                {"bgg_id": int(candidate["bgg_id"]), "votes": counts[int(candidate["bgg_id"])]}
                for candidate in session.candidates
            ],
            "abstain_count": abstain_count,
            "total_ballots": len(ballots),
            "winner_bgg_ids": winner_ids,
            "outcome": (
                "no_votes"
                if highest == 0
                else "tie"
                if len(winner_ids) > 1
                else "winner"
            ),
        }
