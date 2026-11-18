from typing import Literal

from pydantic import BaseModel, Field, field_validator


class FeedbackCreate(BaseModel):
    type: Literal["feature", "problem", "other"]
    message: str = Field(min_length=10, max_length=2000)
    wants_reply: bool = False
    app_version: str | None = Field(default=None, max_length=20)
    build: str | None = Field(default=None, max_length=20)
    os: str | None = Field(default=None, max_length=40)
    device: str | None = Field(default=None, max_length=40)

    # Length limits apply to the trimmed text, matching the app's counter.
    @field_validator("message", mode="before")
    @classmethod
    def trim_message(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value
