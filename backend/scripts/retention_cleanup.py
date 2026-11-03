import argparse
import os

from services.retention_cleanup_service import (
    DEFAULT_BATCH_SIZE,
    MAX_BATCH_SIZE,
)


def cleanup_apply_enabled(
    value: str | None,
) -> bool:
    return (
        value is not None
        and value.strip().lower() == "true"
    )


def batch_size(value: str) -> int:
    parsed = int(value)
    if not 1 <= parsed <= MAX_BATCH_SIZE:
        raise argparse.ArgumentTypeError(
            "batch size must be between 1 and "
            f"{MAX_BATCH_SIZE}"
        )
    return parsed


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Preview provisional ShelfPick retention "
            "cleanup, or apply it only when separately "
            "enabled. No scheduler invokes this command."
        )
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help=(
            "Delete eligible rows. Requires "
            "RETENTION_CLEANUP_ENABLED=true."
        ),
    )
    parser.add_argument(
        "--batch-size",
        type=batch_size,
        default=DEFAULT_BATCH_SIZE,
    )
    args = parser.parse_args()

    if args.apply and not cleanup_apply_enabled(
        os.getenv("RETENTION_CLEANUP_ENABLED")
    ):
        parser.error(
            "--apply requires "
            "RETENTION_CLEANUP_ENABLED=true"
        )

    from database.connection import SessionLocal
    from repositories.retention_repository import (
        RetentionRepository,
    )
    from services.retention_cleanup_service import (
        RetentionCleanupService,
    )

    db = SessionLocal()
    try:
        service = RetentionCleanupService(
            RetentionRepository(db)
        )
        result = (
            service.apply(
                batch_size=args.batch_size
            )
            if args.apply
            else service.preview()
        )
    finally:
        db.close()

    mode = "apply" if args.apply else "dry-run"
    print(
        f"mode={mode} "
        "expired_auth_tokens="
        f"{result.expired_auth_tokens} "
        "expired_game_night_sessions="
        f"{result.expired_game_night_sessions}"
    )


if __name__ == "__main__":
    main()
