import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(
    __file__
).resolve().parent

load_dotenv(
    BACKEND_DIR / ".env"
)


def _get_bool(
    name: str,
    default: bool = False,
) -> bool:
    value = os.getenv(
        name
    )

    if value is None:
        return default

    return (
        value.strip().lower()
        in {
            "1",
            "true",
            "yes",
            "on",
        }
    )


def _get_strict_bool(
    name: str,
    default: bool = False,
) -> bool:
    value = os.getenv(name)
    if value is None:
        return default

    normalised = value.strip().lower()
    if normalised in {"1", "true", "yes", "on"}:
        return True
    if normalised in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(
        f"{name} must be a boolean value"
    )


@dataclass(frozen=True)
class Settings:
    environment: str
    database_url: str
    jwt_secret: str
    access_token_minutes: int
    cors_origins: list[str]
    ai_picker_enabled: bool
    frontend_url: str
    resend_api_key: str
    email_from: str
    bgg_api_token: str
    beta_invite_emails: frozenset[str]
    export_cover_artwork_enabled: bool


def get_settings() -> Settings:
    environment = os.getenv(
        "APP_ENV",
        "development",
    ).strip().lower()

    database_url = os.getenv(
        "DATABASE_URL",
        "",
    ).strip()

    jwt_secret = os.getenv(
        "JWT_SECRET",
        "",
    ).strip()

    cors_origins = [
        origin.strip().rstrip("/")
        for origin in os.getenv(
            "CORS_ORIGINS",
            (
                "http://localhost:5173,"
                "http://127.0.0.1:5173"
            ),
        ).split(",")
        if origin.strip()
    ]

    access_token_minutes = int(
        os.getenv(
            "ACCESS_TOKEN_MINUTES",
            "1440",
        )
    )

    ai_picker_enabled = _get_bool(
        "AI_PICKER_ENABLED",
        False,
    )

    frontend_url = os.getenv(
        "FRONTEND_URL",
        "http://localhost:5173",
    ).strip().rstrip("/")

    resend_api_key = os.getenv(
        "RESEND_API_KEY",
        "",
    ).strip()

    email_from = os.getenv(
        "EMAIL_FROM",
        "ShelfPick <onboarding@resend.dev>",
    ).strip()

    bgg_api_token = os.getenv(
        "BGG_API_TOKEN",
        "",
    ).strip()

    beta_invite_emails = frozenset(
        email.strip().casefold()
        for email in os.getenv("BETA_INVITE_EMAILS", "").split(",")
        if email.strip()
    )

    export_cover_artwork_enabled = (
        _get_strict_bool(
            "EXPORT_COVER_ARTWORK_ENABLED",
            False,
        )
    )

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL must be configured"
        )

    if not jwt_secret:
        raise RuntimeError(
            "JWT_SECRET must be configured"
        )

    if environment == "production":
        if len(jwt_secret) < 32:
            raise RuntimeError(
                "Production JWT_SECRET must be "
                "at least 32 characters"
            )

        if not cors_origins:
            raise RuntimeError(
                "Production CORS_ORIGINS must "
                "contain the frontend origin"
            )

        if any(
            not origin.startswith("https://")
            for origin in cors_origins
        ):
            raise RuntimeError(
                "Production CORS_ORIGINS must "
                "use HTTPS"
            )

        if not frontend_url.startswith(
            "https://"
        ):
            raise RuntimeError(
                "Production FRONTEND_URL must "
                "use HTTPS"
            )

        if ai_picker_enabled:
            raise RuntimeError(
                "AI picker must remain disabled "
                "for the first production release"
            )

        if not resend_api_key:
            raise RuntimeError(
                "RESEND_API_KEY must be configured"
            )

        if (
            not email_from
            or "@resend.dev" in email_from.lower()
        ):
            raise RuntimeError(
                "Production EMAIL_FROM must use "
                "a verified sending domain"
            )

        if not bgg_api_token:
            raise RuntimeError(
                "BGG_API_TOKEN must be configured"
            )

        if not beta_invite_emails:
            raise RuntimeError(
                "BETA_INVITE_EMAILS must contain at least one invited email"
            )

    return Settings(
        environment=environment,
        database_url=database_url,
        jwt_secret=jwt_secret,
        access_token_minutes=(
            access_token_minutes
        ),
        cors_origins=cors_origins,
        ai_picker_enabled=(
            ai_picker_enabled
        ),
        frontend_url=frontend_url,
        resend_api_key=resend_api_key,
        email_from=email_from,
        bgg_api_token=bgg_api_token,
        beta_invite_emails=beta_invite_emails,
        export_cover_artwork_enabled=(
            export_cover_artwork_enabled
        ),
    )


settings = get_settings()
