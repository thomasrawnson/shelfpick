from types import SimpleNamespace

import pytest

from scripts.local_test_accounts import (
    LOCAL_ACCOUNT_MARKER,
    LocalSetupSafetyError,
    validate_local_database_target,
    validate_reserved_account,
)


LOCAL_URL = (
    "postgresql+psycopg://boardgamepicker:password@"
    "localhost:5433/boardgamepicker_commercial"
)


def test_local_account_tool_accepts_explicit_local_development_database():
    validate_local_database_target("development", LOCAL_URL)


@pytest.mark.parametrize("environment", ["production", "staging", "test"])
def test_local_account_tool_rejects_non_development_environments(environment):
    with pytest.raises(LocalSetupSafetyError, match="APP_ENV=development"):
        validate_local_database_target(environment, LOCAL_URL)


@pytest.mark.parametrize("host", ["db.example.com", "10.0.0.5", "production.internal"])
def test_local_account_tool_rejects_remote_database_targets(host):
    url = f"postgresql+psycopg://user:password@{host}:5432/boardgamepicker_commercial"
    with pytest.raises(LocalSetupSafetyError, match="non-loopback"):
        validate_local_database_target("development", url)


@pytest.mark.parametrize(
    "url",
    [
        "postgresql+psycopg://user:password@localhost:5432/shelfpick_production",
        "sqlite:///local.db",
    ],
)
def test_local_account_tool_rejects_unapproved_database_names_and_engines(url):
    with pytest.raises(LocalSetupSafetyError):
        validate_local_database_target("development", url)


def test_local_account_tool_refuses_to_overwrite_an_unmarked_account():
    existing = SimpleNamespace(bgg_username="personal-bgg-name")

    with pytest.raises(LocalSetupSafetyError, match="without the local-test marker"):
        validate_reserved_account(existing, "local-free@shelfpick.app")


def test_local_account_tool_accepts_only_its_marked_account_for_refresh():
    existing = SimpleNamespace(bgg_username=LOCAL_ACCOUNT_MARKER)

    validate_reserved_account(existing, "local-free@shelfpick.app")
