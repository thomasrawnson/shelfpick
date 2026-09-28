from datetime import (
    datetime,
    timezone,
)

from models.play import Play
from services.play_service import (
    PlayService,
)


class FakePlayRepository:
    def __init__(self):
        self.created = None

    def create(
        self,
        bgg_id: int,
        played_at,
        duration_minutes: int | None,
        participants: list[dict],
        location: str | None = None,
        timer_session_id: str | None = None,
    ) -> Play:
        self.created = {
            "bgg_id": bgg_id,
            "played_at": played_at,
            "duration_minutes": (
                duration_minutes
            ),
            "participants": participants,
            "location": location,
            "timer_session_id": timer_session_id,
        }

        return Play(
            id=1,
            bgg_id=bgg_id,
            player_count=len(participants),
            played_at=played_at,
        )


def test_record_play_uses_repository():
    repository = FakePlayRepository()
    service = PlayService(repository)

    played_at = datetime(
        2026,
        8,
        28,
        20,
        0,
        tzinfo=timezone.utc,
    )

    participants = [
        {
            "name": "Tom",
            "score": 83,
            "is_winner": True,
        },
        {
            "name": "Sarah",
            "score": 72,
            "is_winner": False,
        },
    ]

    play = service.record_play(
        bgg_id=167791,
        played_at=played_at,
        duration_minutes=75,
        participants=participants,
        location="  The   Dice Cup  ",
    )

    assert repository.created == {
        "bgg_id": 167791,
        "played_at": played_at,
        "duration_minutes": 75,
        "participants": participants,
        "location": "The Dice Cup",
        "timer_session_id": None,
    }

    assert play.bgg_id == 167791
    assert play.player_count == 2
