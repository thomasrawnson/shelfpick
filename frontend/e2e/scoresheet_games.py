"""E2E helper (SP-SCORE-01): shelve three games that have built-in
scoresheets for the local Free and Pro test accounts.

Run from backend/ with the backend Python. Same safety rules as
scripts/local_test_accounts.py: APP_ENV=development on an allowed loopback
PostgreSQL database, and only accounts carrying the local-test marker.
"""

from config import settings
from database.connection import SessionLocal
from database.models import Game, User, UserGame
from scripts.local_test_accounts import (
    LOCAL_ACCOUNT_MARKER,
    LocalSetupSafetyError,
    validate_local_database_target,
)

GAMES = (
    (266192, "[Local Dev] Wingspan", 1, 5),
    (204135, "[Local Dev] Skyjo", 2, 8),
    (98778, "[Local Dev] Hanabi", 2, 5),
)
EMAILS = ("local-free@shelfpick.app", "local-pro@shelfpick.app")


def main() -> None:
    validate_local_database_target(settings.environment, settings.database_url)
    with SessionLocal() as db:
        users = []
        for email in EMAILS:
            user = db.query(User).filter(User.email == email).first()
            if user is None or user.bgg_username != LOCAL_ACCOUNT_MARKER:
                raise LocalSetupSafetyError(f"{email} is not a local test account; run setup first.")
            users.append(user)
        for bgg_id, name, low, high in GAMES:
            game = db.query(Game).filter(Game.bgg_id == bgg_id).first()
            if game is None:
                game = Game(
                    bgg_id=bgg_id, name=name, year_published=2026,
                    min_players=low, max_players=high, min_play_time=20,
                    max_play_time=60, complexity=2.0, rating=7.5,
                    best_player_counts=[3], recommended_player_counts=[2, 3, 4],
                    player_count_poll=[], min_age=8, min_age_checked=True,
                    is_expansion=False, expansion_checked=True, designers=[],
                    publishers=[], credits_checked=True, owned=False,
                    image_url=None, thumbnail_url=None,
                )
                db.add(game)
                db.flush()
            for user in users:
                linked = db.query(UserGame).filter(
                    UserGame.user_id == user.id, UserGame.game_id == game.id,
                ).first()
                if linked is None:
                    db.add(UserGame(user_id=user.id, game_id=game.id, source="local-dev"))
        db.commit()
    print("Scoresheet games are on the local test shelves.")


if __name__ == "__main__":
    main()
