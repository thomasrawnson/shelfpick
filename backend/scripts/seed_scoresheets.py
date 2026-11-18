"""Seed built-in scoresheets from ``scoresheets/templates``.

Run after ``alembic upgrade head`` on every deploy:

    python -m scripts.seed_scoresheets

Idempotent; every template is validated before anything is written.
"""

from database.connection import SessionLocal
from repositories.scoresheet_repository import ScoresheetRepository
from services.scoresheet_service import seed_builtin_scoresheets


def main() -> None:
    with SessionLocal() as db:
        counts = seed_builtin_scoresheets(ScoresheetRepository(db))
    print(
        "Built-in scoresheets: "
        f"{counts['created']} created, {counts['updated']} updated, "
        f"{counts['unchanged']} unchanged"
    )


if __name__ == "__main__":
    main()
