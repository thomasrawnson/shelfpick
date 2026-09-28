from pydantic import (
    BaseModel,
    EmailStr,
    Field,
)
from typing import Literal


class RegisterRequest(BaseModel):
    email: EmailStr

    display_name: str = Field(
        min_length=1,
        max_length=100,
    )

    password: str = Field(
        min_length=8,
        max_length=128,
    )


class LoginRequest(BaseModel):
    email: EmailStr

    password: str = Field(
        min_length=1,
        max_length=128,
    )


class UserResponse(BaseModel):
    id: int
    email: str
    display_name: str | None
    bgg_username: str | None
    email_verified: bool
    tier: str
    entitlements: list[str]
    onboarding_completed: bool
    preferred_player_count: int | None
    preferred_play_time: int | None
    preferred_play_style: Literal["any", "cooperative", "competitive"] | None
    profile_player_id: int | None
    player_name: str
    avatar_key: str


class ProfileUpdateRequest(BaseModel):
    player_name: str | None = Field(default=None, min_length=1, max_length=100)
    avatar_key: Literal["forest", "gold", "clay", "dice", "meeple", "cards"] | None = None
    preferred_player_count: int | None = Field(default=None, ge=1, le=12)
    preferred_play_time: Literal[0, 15, 30, 60, 90, 120] | None = None
    preferred_play_style: Literal["any", "cooperative", "competitive"] | None = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class EmailRequest(BaseModel):
    email: EmailStr


class TokenRequest(BaseModel):
    token: str = Field(
        min_length=1,
        max_length=512,
    )

class ResetPasswordRequest(
    TokenRequest
):
    password: str = Field(
        min_length=8,
        max_length=128,
    )

class MessageResponse(BaseModel):
    message: str
