import pytest

from scripts.scoresheet_preview import PreviewSafetyError, validate_preview_target


LOCAL_URL = (
    "postgresql+psycopg://shelfpick_test:shelfpick_score03a_local"
    "@127.0.0.1:55433/shelfpick_score03a_test"
)


def test_preview_target_accepts_only_the_named_local_development_database():
    validate_preview_target("development", LOCAL_URL)


@pytest.mark.parametrize(
    ("environment", "database_url"),
    [
        ("production", LOCAL_URL),
        (
            "development",
            "postgresql+psycopg://user:password@db.example.com/shelfpick_score03a_test",
        ),
        (
            "development",
            "postgresql+psycopg://user:password@127.0.0.1/shelfpick",
        ),
        ("development", "sqlite:///score03a.db"),
    ],
)
def test_preview_target_rejects_unsafe_targets(environment, database_url):
    with pytest.raises(PreviewSafetyError):
        validate_preview_target(environment, database_url)
