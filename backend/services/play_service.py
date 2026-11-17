from models.play import Play
from services.play_results import normalize_results
from repositories.play_repository import (
    PlayRepository,
)


class PlayService:
    def __init__(
        self,
        repository: PlayRepository,
    ):
        self.repository = repository

    @staticmethod
    def _normalize_player_name(
        name: str,
    ) -> str:
        return " ".join(
            name
            .strip()
            .lower()
            .split()
        )

    def record_play(
        self,
        bgg_id: int,
        played_at,
        duration_minutes: int | None,
        participants: list[dict],
        location: str | None = None,
        timer_session_id: str | None = None,
        outcome_type: str = "competitive",
        coop_result: str | None = None,
    ) -> Play | None:
        self._reject_duplicate_players(participants)
        coop_result, participants = normalize_results(
            outcome_type, coop_result, participants
        )

        cleaned_location = " ".join(location.split()) if location else None

        return self.repository.create(
            bgg_id=bgg_id,
            played_at=played_at,
            duration_minutes=(
                duration_minutes
            ),
            participants=participants,
            location=cleaned_location or None,
            timer_session_id=timer_session_id,
            outcome_type=outcome_type,
            coop_result=coop_result,
        )

    def update_play(
        self,
        play_id: int,
        changes: dict,
    ) -> dict | None:
        """Apply a partial edit. ``changes`` holds only the sent fields."""
        state = self.repository.get_play_for_edit(play_id)
        if state is None:
            return None

        state.update(changes)
        if state["played_at"] is None:
            raise ValueError("A play needs a date.")
        if state["location"] is not None:
            state["location"] = (
                " ".join(state["location"].split()) or None
            )

        self._reject_duplicate_players(state["participants"])
        state["coop_result"], state["participants"] = normalize_results(
            state["outcome_type"],
            state["coop_result"],
            state["participants"],
        )

        updated = self.repository.update(play_id, state)
        if updated is None:
            raise ValueError("Game not found in your collection.")
        return updated

    def _reject_duplicate_players(self, participants: list[dict]) -> None:
        names = [
            self._normalize_player_name(participant["name"])
            for participant in participants
        ]
        if len(set(names)) != len(names):
            raise ValueError("The same player cannot be added twice.")

    def delete_play(
        self,
        play_id: int,
    ) -> bool:
        return (
            self.repository.delete(
                play_id
            )
        )
