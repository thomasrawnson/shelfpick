import argparse
import os
import sys
from datetime import datetime, timezone

from sqlalchemy.engine import make_url

from auth.security import hash_password
from config import settings
from database.connection import SessionLocal
from database.models import (
    Game,
    GameComparison,
    GameRanking,
    LivePlayTimer,
    Play,
    Player,
    User,
    UserGame,
    UserWishlistGame,
)


LOCAL_ACCOUNT_MARKER = "__shelfpick_local_test_account__"
DEFAULT_PASSWORD = "ShelfPickLocal123!"
ALLOWED_DATABASE_NAMES = {
    "boardgamepicker_commercial",
    "shelfpick_development",
    "shelfpick_dev",
}
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}

ACCOUNTS = (
    {
        "email": "local-free@shelfpick.app",
        "display_name": "Free Local Tester",
        "player_name": "Free Host",
        "tier": "FREE",
        "avatar_key": "forest",
    },
    {
        "email": "local-pro@shelfpick.app",
        "display_name": "Pro Local Tester",
        "player_name": "Pro Host",
        "tier": "PRO",
        "avatar_key": "dice",
    },
)

GAMES = (
    {
        "bgg_id": 99000001,
        "name": "[Local Dev] Lantern Grove",
        "year_published": 2026,
        "min_players": 1,
        "max_players": 4,
        "min_play_time": 25,
        "max_play_time": 40,
        "complexity": 1.8,
        "rating": 7.4,
    },
    {
        "bgg_id": 99000002,
        "name": "[Local Dev] Clockwork Market",
        "year_published": 2026,
        "min_players": 2,
        "max_players": 5,
        "min_play_time": 35,
        "max_play_time": 55,
        "complexity": 2.3,
        "rating": 7.7,
    },
    {
        "bgg_id": 99000003,
        "name": "[Local Dev] Harbour Council",
        "year_published": 2026,
        "min_players": 2,
        "max_players": 4,
        "min_play_time": 45,
        "max_play_time": 60,
        "complexity": 2.7,
        "rating": 7.9,
    },
)


class LocalSetupSafetyError(RuntimeError):
    pass


def validate_local_database_target(environment: str, database_url: str) -> None:
    if environment.strip().lower() != "development":
        raise LocalSetupSafetyError(
            "Local account tooling requires APP_ENV=development."
        )

    try:
        url = make_url(database_url)
    except Exception as exc:
        raise LocalSetupSafetyError("DATABASE_URL is not a valid database URL.") from exc

    if not url.drivername.startswith("postgresql"):
        raise LocalSetupSafetyError(
            "Local account tooling requires a PostgreSQL development database."
        )
    if url.host not in LOCAL_HOSTS:
        raise LocalSetupSafetyError(
            "Refusing a non-loopback DATABASE_URL. Use localhost, 127.0.0.1 or ::1."
        )
    if url.database not in ALLOWED_DATABASE_NAMES:
        allowed = ", ".join(sorted(ALLOWED_DATABASE_NAMES))
        raise LocalSetupSafetyError(
            f"Refusing database {url.database!r}. Allowed local development databases: {allowed}."
        )


def _normalise_name(name: str) -> str:
    return " ".join(name.strip().lower().split())


def validate_reserved_account(user: User | None, email: str) -> None:
    if user is not None and user.bgg_username != LOCAL_ACCOUNT_MARKER:
        raise LocalSetupSafetyError(
            f"Account {email} exists without the local-test marker; no data changed."
        )


def _ensure_game(db, specification: dict) -> Game:
    game = db.query(Game).filter(Game.bgg_id == specification["bgg_id"]).first()
    if game is not None and game.name != specification["name"]:
        raise LocalSetupSafetyError(
            f"Synthetic BGG ID {specification['bgg_id']} is already used by "
            f"{game.name!r}; no data changed."
        )
    if game is None:
        game = Game(
            **specification,
            best_player_counts=[2],
            recommended_player_counts=[1, 2, 3, 4],
            player_count_poll=[],
            min_age=8,
            min_age_checked=True,
            is_expansion=False,
            expansion_checked=True,
            designers=[],
            publishers=[],
            credits_checked=True,
            owned=False,
            image_url=None,
            thumbnail_url=None,
        )
        db.add(game)
        db.flush()
    return game


def _ensure_player(db, user: User, name: str, avatar_key: str) -> Player:
    normalized = _normalise_name(name)
    player = (
        db.query(Player)
        .filter(Player.user_id == user.id, Player.normalized_name == normalized)
        .first()
    )
    if player is None:
        player = Player(
            user_id=user.id,
            name=name,
            normalized_name=normalized,
            avatar_key=avatar_key,
        )
        db.add(player)
        db.flush()
    else:
        player.name = name
        player.avatar_key = avatar_key
    return player


def _ensure_account(db, specification: dict, password: str, games: list[Game]) -> User:
    user = db.query(User).filter(User.email == specification["email"]).first()
    validate_reserved_account(user, specification["email"])
    if user is None:
        user = User(email=specification["email"])
        db.add(user)
        db.flush()

    user.display_name = specification["display_name"]
    user.bgg_username = LOCAL_ACCOUNT_MARKER
    user.password_hash = hash_password(password)
    user.email_verified_at = datetime.now(timezone.utc)
    user.onboarding_completed = True
    user.preferred_player_count = 2
    user.preferred_play_time = 60
    user.preferred_play_style = "any"
    user.tier = specification["tier"]

    profile = _ensure_player(
        db, user, specification["player_name"], specification["avatar_key"]
    )
    _ensure_player(db, user, "Guest Tester", "meeple")
    user.profile_player_id = profile.id

    for game in games:
        membership = (
            db.query(UserGame)
            .filter(UserGame.user_id == user.id, UserGame.game_id == game.id)
            .first()
        )
        if membership is None:
            db.add(UserGame(user_id=user.id, game_id=game.id, source="local-dev"))
    return user


def setup_accounts(db, password: str) -> None:
    games = [_ensure_game(db, specification) for specification in GAMES]
    for specification in ACCOUNTS:
        _ensure_account(db, specification, password, games)
    db.commit()


def _game_has_other_data(db, game: Game) -> bool:
    comparisons = db.query(GameComparison).filter(
        (GameComparison.winner_game_id == game.id)
        | (GameComparison.loser_game_id == game.id)
    )
    return any(
        query.first() is not None
        for query in (
            db.query(UserGame).filter(UserGame.game_id == game.id),
            db.query(UserWishlistGame).filter(UserWishlistGame.game_id == game.id),
            db.query(Play).filter(Play.game_id == game.id),
            db.query(LivePlayTimer).filter(LivePlayTimer.game_id == game.id),
            db.query(GameRanking).filter(GameRanking.game_id == game.id),
            comparisons,
        )
    )


def remove_accounts(db) -> None:
    for specification in ACCOUNTS:
        user = db.query(User).filter(User.email == specification["email"]).first()
        if user is None:
            continue
        if user.bgg_username != LOCAL_ACCOUNT_MARKER:
            raise LocalSetupSafetyError(
                f"Refusing to remove unmarked account {specification['email']}."
            )
        db.delete(user)
    db.flush()

    for specification in GAMES:
        game = db.query(Game).filter(Game.bgg_id == specification["bgg_id"]).first()
        if game is None or game.name != specification["name"]:
            continue
        if not _game_has_other_data(db, game):
            db.delete(game)
    db.commit()


def print_status(db) -> None:
    for specification in ACCOUNTS:
        user = db.query(User).filter(User.email == specification["email"]).first()
        state = "missing" if user is None else f"present ({user.tier})"
        print(f"{specification['email']}: {state}")
    game_count = db.query(Game).filter(
        Game.bgg_id.in_([game["bgg_id"] for game in GAMES])
    ).count()
    print(f"Local synthetic games present: {game_count}/{len(GAMES)}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Manage dedicated Free and Pro accounts in a local ShelfPick "
            "development database."
        )
    )
    parser.add_argument("command", choices=("setup", "status", "remove"))
    arguments = parser.parse_args()

    try:
        validate_local_database_target(settings.environment, settings.database_url)
    except LocalSetupSafetyError as exc:
        print(f"Safety check failed: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc

    password = os.getenv("SHELFPICK_LOCAL_TEST_PASSWORD", DEFAULT_PASSWORD)
    if arguments.command == "setup" and len(password) < 12:
        print(
            "SHELFPICK_LOCAL_TEST_PASSWORD must be at least 12 characters.",
            file=sys.stderr,
        )
        raise SystemExit(2)

    db = SessionLocal()
    try:
        if arguments.command == "setup":
            setup_accounts(db, password)
            print("Local Free and Pro accounts are ready.")
            print(f"Free: {ACCOUNTS[0]['email']}")
            print(f"Pro:  {ACCOUNTS[1]['email']}")
            print(
                "Password: SHELFPICK_LOCAL_TEST_PASSWORD or the documented "
                "local default."
            )
        elif arguments.command == "remove":
            remove_accounts(db)
            print("Dedicated local test accounts and unreferenced synthetic games removed.")
        else:
            print_status(db)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
