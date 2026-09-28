from models.play import Play
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
    ) -> Play | None:
        normalized_names = [
            self._normalize_player_name(
                participant["name"]
            )
            for participant
            in participants
        ]

        if (
            len(
                set(
                    normalized_names
                )
            )
            !=
            len(
                normalized_names
            )
        ):
            raise ValueError(
                "The same player cannot "
                "be added twice."
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
        )

    def delete_play(
        self,
        play_id: int,
    ) -> bool:
        return (
            self.repository.delete(
                play_id
            )
        )
