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
        outcome_type: str = "competitive",
        coop_result: str | None = None,
        scoresheet_id: int | None = None,
        scoresheet_version: int | None = None,
        result_overridden: bool = False,
        client_id: str | None = None,
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
            "outcome_type": outcome_type,
            "coop_result": coop_result,
            "client_id": client_id,
        }

        return Play(
            id=1,
            bgg_id=bgg_id,
            player_count=len(participants),
            played_at=played_at,
        )


def test_record_play_uses_repository():
    repository = FakePlayRepository()
    service = PlayService(repository, scoresheets=None)

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
        "participants": [
            {**participant, "team": None, "role": None, "rank": None}
            for participant in participants
        ],
        "location": "The Dice Cup",
        "timer_session_id": None,
        "outcome_type": "competitive",
        "coop_result": None,
        "client_id": None,
    }

    assert play.bgg_id == 167791
    assert play.player_count == 2


def test_record_play_passes_the_client_id_to_the_repository():
    repository = FakePlayRepository()
    service = PlayService(repository, scoresheets=None)
    client_id = "6f1c1f0e-8a49-4f3c-9d3e-0c6f6d3a2b11"

    service.record_play(
        bgg_id=1, played_at=None, duration_minutes=None,
        participants=[{"name": "Tom", "score": 1, "is_winner": True}],
        client_id=client_id,
    )

    assert repository.created["client_id"] == client_id
