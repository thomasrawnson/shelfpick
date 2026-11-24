from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
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

    # Scoresheet entries by category id; the server computes the score.
    score_breakdown: dict[str, Any] | None = Field(default=None, max_length=60)


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

    # Random id the app makes for each new play; a repeat returns that play.
    client_id: str | None = Field(default=None, min_length=36, max_length=36)

    participants: list[
        PlayParticipantCreate
    ] = Field(
        min_length=1,
        max_length=20,
    )

    outcome_type: OutcomeType = "competitive"

    coop_result: CoopResult | None = None

    scoresheet_id: int | None = Field(default=None, gt=0)

    scoresheet_version: int | None = Field(default=None, ge=1)

    # True keeps the client's winners, ranks and result instead of the
    # scoresheet's calculated result.
    result_override: bool = False

    picker_session_id: str | None = Field(
        default=None,
        min_length=36,
        max_length=36,
    )

    @field_validator("client_id")
    @classmethod
    def canonical_client_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            return str(UUID(value))
        except ValueError as exc:
            raise ValueError("client_id must be a UUID") from exc


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

    scoresheet_id: int | None = Field(default=None, gt=0)

    scoresheet_version: int | None = Field(default=None, ge=1)

    result_override: bool | None = None


class LiveTimerStart(BaseModel):
    bgg_id: int = Field(gt=0)
    participant_names: list[str] = Field(default_factory=list, max_length=12)
    location: str | None = Field(default=None, max_length=200)
