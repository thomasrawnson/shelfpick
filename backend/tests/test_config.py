import pytest

from config import get_settings


def production_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    values = {
        "APP_ENV": "production",
        "DATABASE_URL": (
            "postgresql://user:password@db/app"
        ),
        "JWT_SECRET": "x" * 32,
        "CORS_ORIGINS": (
            "https://app.example.com/"
        ),
        "FRONTEND_URL": (
            "https://app.example.com/"
        ),
        "AI_PICKER_ENABLED": "false",
        "RESEND_API_KEY": "re_test_key",
        "EMAIL_FROM": (
            "BoardGamePicker "
            "<accounts@mail.example.com>"
        ),
        "BGG_API_TOKEN": (
            "test-bgg-token-not-a-real-secret"
        ),
        "BETA_INVITE_EMAILS": " Invited@Example.com ",
    }

    for name, value in values.items():
        monkeypatch.setenv(name, value)


def test_production_settings_are_normalised(
    monkeypatch: pytest.MonkeyPatch,
):
    production_environment(monkeypatch)

    settings = get_settings()

    assert settings.frontend_url == (
        "https://app.example.com"
    )
    assert settings.cors_origins == [
        "https://app.example.com"
    ]
    assert settings.bgg_api_token == (
        "test-bgg-token-not-a-real-secret"
    )
    assert settings.beta_invite_emails == frozenset({"invited@example.com"})


@pytest.mark.parametrize(
    ("name", "value", "message"),
    [
        (
            "JWT_SECRET",
            "too-short",
            "at least 32 characters",
        ),
        (
            "CORS_ORIGINS",
            "http://app.example.com",
            "must use HTTPS",
        ),
        (
            "FRONTEND_URL",
            "http://app.example.com",
            "must use HTTPS",
        ),
        (
            "AI_PICKER_ENABLED",
            "true",
            "must remain disabled",
        ),
        (
            "RESEND_API_KEY",
            "",
            "RESEND_API_KEY",
        ),
        (
            "EMAIL_FROM",
            "BoardGamePicker <onboarding@resend.dev>",
            "verified sending domain",
        ),
        (
            "BGG_API_TOKEN",
            "",
            "BGG_API_TOKEN",
        ),
        (
            "BGG_API_TOKEN",
            "   ",
            "BGG_API_TOKEN",
        ),
        (
            "BETA_INVITE_EMAILS",
            "",
            "BETA_INVITE_EMAILS",
        ),
    ],
)
def test_invalid_production_settings_fail_fast(
    monkeypatch: pytest.MonkeyPatch,
    name: str,
    value: str,
    message: str,
):
    production_environment(monkeypatch)
    monkeypatch.setenv(name, value)

    with pytest.raises(
        RuntimeError,
        match=message,
    ):
        get_settings()


@pytest.mark.parametrize(
    "environment",
    [
        "development",
        "test",
    ],
)
def test_bgg_token_is_optional_outside_production(
    monkeypatch: pytest.MonkeyPatch,
    environment: str,
):
    monkeypatch.setenv(
        "APP_ENV",
        environment,
    )
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://user:password@db/app",
    )
    monkeypatch.setenv(
        "JWT_SECRET",
        "local-or-test-secret",
    )
    monkeypatch.delenv(
        "BGG_API_TOKEN",
        raising=False,
    )

    assert get_settings().bgg_api_token == ""


def test_production_error_does_not_reveal_tokens(
    monkeypatch: pytest.MonkeyPatch,
):
    production_environment(monkeypatch)
    bgg_token = (
        "sensitive-bgg-token-must-not-appear"
    )
    resend_key = (
        "sensitive-resend-key-must-not-appear"
    )
    monkeypatch.setenv(
        "BGG_API_TOKEN",
        bgg_token,
    )
    monkeypatch.setenv(
        "RESEND_API_KEY",
        resend_key,
    )
    monkeypatch.setenv(
        "FRONTEND_URL",
        "http://app.example.com",
    )

    with pytest.raises(RuntimeError) as error:
        get_settings()

    message = str(error.value)
    assert bgg_token not in message
    assert resend_key not in message
