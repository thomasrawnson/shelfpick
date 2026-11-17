from datetime import datetime
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


OutcomeType = Literal["competitive", "cooperative", "team", "solo"]
CoopResult = Literal["won", "lost"]


class PlayParticipantCreate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=100,
    )

    score: float | None = None

    is_winner: bool = False

    team: str | None = Field(default=None, max_length=50)

    rank: int | None = Field(default=None, ge=1, le=99)

    role: str | None = Field(default=None, max_length=50)


class PlayerCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=100)


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
        max_length=20,
    )

    outcome_type: OutcomeType = "competitive"

    coop_result: CoopResult | None = None

    picker_session_id: str | None = Field(
        default=None,
        min_length=36,
        max_length=36,
    )


class PlayUpdate(BaseModel):
    """Partial edit; only fields that are sent change."""

    bgg_id: int | None = Field(default=None, gt=0)

    played_at: datetime | None = None

    duration_minutes: int | None = Field(default=None, ge=0)

    location: str | None = Field(default=None, max_length=200)

    participants: list[PlayParticipantCreate] | None = Field(
        default=None,
        min_length=1,
        max_length=20,
    )

    outcome_type: OutcomeType | None = None

    coop_result: CoopResult | None = None


class LiveTimerStart(BaseModel):
    bgg_id: int = Field(gt=0)
    participant_names: list[str] = Field(default_factory=list, max_length=12)
    location: str | None = Field(default=None, max_length=200)
