import argparse
import os
import re
import sys
from datetime import datetime, timezone

from sqlalchemy.engine import make_url

from auth.login_rate_limiter import DatabaseAuthRateLimiter
from auth.one_time_tokens import EMAIL_VERIFY, create_one_time_token
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

# Reset to a fresh, verified account that has not completed onboarding. Used
# by the automated onboarding/account-options acceptance tests.
ONBOARDING_ACCOUNT = {
    "email": "local-onboarding@shelfpick.app",
    "display_name": "Onboarding Local Tester",
    "tier": "FREE",
}

# Accounts created through the normal registration UI by the automated
# deletion test. Only these addresses may receive a locally issued
# verification token.
DISPOSABLE_EMAIL_PATTERN = re.compile(r"^e2e-disposable-[a-z0-9-]{6,64}@shelfpick\.app$")

# Auth limiter scopes that the acceptance tests exercise from loopback.
LOOPBACK_RATE_LIMIT_SCOPES = ("login", "register", "verification", "password-reset")

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


def _reset_onboarding_account(db, specification: dict, password: str) -> User:
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
    user.tier = specification["tier"]
    # No onboarding answers: no preferences, profile player, players or
    # collection memberships that onboarding could have created.
    user.onboarding_completed = False
    user.preferred_player_count = None
    user.preferred_play_time = None
    user.preferred_play_style = None
    user.profile_player_id = None
    db.flush()
    db.query(UserGame).filter(UserGame.user_id == user.id).delete(
        synchronize_session=False
    )
    db.query(Player).filter(Player.user_id == user.id).delete(
        synchronize_session=False
    )
    return user


def setup_accounts(db, password: str) -> None:
    games = [_ensure_game(db, specification) for specification in GAMES]
    for specification in ACCOUNTS:
        _ensure_account(db, specification, password, games)
    _reset_onboarding_account(db, ONBOARDING_ACCOUNT, password)
    db.commit()


def reset_loopback_rate_limits(db) -> None:
    limiter = DatabaseAuthRateLimiter(db)
    for scope in LOOPBACK_RATE_LIMIT_SCOPES:
        for host in sorted(LOCAL_HOSTS):
            limiter.reset(f"{scope}:ip", host)


def validate_disposable_email(email: str) -> str:
    normalised = email.strip().lower()
    if not DISPOSABLE_EMAIL_PATTERN.fullmatch(normalised):
        raise LocalSetupSafetyError(
            "Verification tokens are issued only for e2e-disposable-*@shelfpick.app addresses."
        )
    return normalised


def issue_disposable_verification_token(db, email: str) -> str:
    normalised = validate_disposable_email(email)
    user = db.query(User).filter(User.email == normalised).first()
    if user is None:
        raise LocalSetupSafetyError(f"No account exists for {normalised}.")
    if user.email_verified_at is not None:
        raise LocalSetupSafetyError(f"{normalised} is already verified.")
    return create_one_time_token(db, user.id, EMAIL_VERIFY)


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
    for specification in (*ACCOUNTS, ONBOARDING_ACCOUNT):
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
    for specification in (*ACCOUNTS, ONBOARDING_ACCOUNT):
        user = db.query(User).filter(User.email == specification["email"]).first()
        state = "missing" if user is None else f"present ({user.tier})"
        if user is not None and not user.onboarding_completed:
            state += ", onboarding incomplete"
        print(f"{specification['email']}: {state}")
    game_count = db.query(Game).filter(
        Game.bgg_id.in_([game["bgg_id"] for game in GAMES])
    ).count()
    print(f"Local synthetic games present: {game_count}/{len(GAMES)}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Manage dedicated Free, Pro and onboarding accounts in a local "
            "ShelfPick development database."
        )
    )
    parser.add_argument(
        "command", choices=("setup", "status", "remove", "verification-token")
    )
    parser.add_argument(
        "email", nargs="?",
        help="verification-token only: an e2e-disposable-*@shelfpick.app address.",
    )
    parser.add_argument(
        "--reset-loopback-rate-limits", action="store_true",
        help="setup only: clear auth rate-limit buckets for loopback clients.",
    )
    arguments = parser.parse_args()
    if arguments.command == "verification-token" and not arguments.email:
        parser.error("verification-token requires an email address")

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
            if arguments.reset_loopback_rate_limits:
                reset_loopback_rate_limits(db)
            print("Local Free, Pro and onboarding accounts are ready.")
            print(f"Free: {ACCOUNTS[0]['email']}")
            print(f"Pro:  {ACCOUNTS[1]['email']}")
            print(f"Onboarding (incomplete): {ONBOARDING_ACCOUNT['email']}")
            print(
                "Password: SHELFPICK_LOCAL_TEST_PASSWORD or the documented "
                "local default."
            )
        elif arguments.command == "verification-token":
            print(issue_disposable_verification_token(db, arguments.email))
        elif arguments.command == "remove":
            remove_accounts(db)
            print("Dedicated local test accounts and unreferenced synthetic games removed.")
        else:
            print_status(db)
    except LocalSetupSafetyError as exc:
        db.rollback()
        print(f"Safety check failed: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
