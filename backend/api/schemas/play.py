from datetime import datetime

from pydantic import (
    BaseModel,
    Field,
)


class PlayParticipantCreate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=100,
    )

    score: float | None = None

    is_winner: bool = False


class PlayCreate(BaseModel):
    bgg_id: int = Field(gt=0)

    played_at: datetime | None = None

    duration_minutes: int | None = Field(
        default=None,
        ge=0,
    )

    location: str | None = Field(default=None, max_length=200)

    timer_session_id: str | None = Field(default=None, min_length=36, max_length=36)

    participants: list[
        PlayParticipantCreate
    ] = Field(
        min_length=1,
    )

    picker_session_id: str | None = Field(
        default=None,
        min_length=36,
        max_length=36,
    )


class LiveTimerStart(BaseModel):
    bgg_id: int = Field(gt=0)
    participant_names: list[str] = Field(default_factory=list, max_length=12)
    location: str | None = Field(default=None, max_length=200)
