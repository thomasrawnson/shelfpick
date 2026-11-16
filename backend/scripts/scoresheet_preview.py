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


DATABASE_NAME = "shelfpick_score03a_test"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
ACCOUNT_MARKER = "__shelfpick_score03a_preview__"
ACCOUNT_EMAIL = "score03a-review@example.com"

GAMES = (
    {
        "bgg_id": 266192,
        "name": "Wingspan",
        "year_published": 2019,
        "min_players": 1,
        "max_players": 5,
        "min_play_time": 40,
        "max_play_time": 70,
        "complexity": 2.5,
        "rating": 8.1,
    },
    {
        "bgg_id": 167791,
        "name": "Terraforming Mars",
        "year_published": 2016,
        "min_players": 1,
        "max_players": 5,
        "min_play_time": 120,
        "max_play_time": 120,
        "complexity": 3.3,
        "rating": 8.4,
    },
    {
        "bgg_id": 414317,
        "name": "Harmonies",
        "year_published": 2024,
        "min_players": 1,
        "max_players": 4,
        "min_play_time": 30,
        "max_play_time": 45,
        "complexity": 1.9,
        "rating": 8.0,
    },
)


class PreviewSafetyError(RuntimeError):
    pass


def validate_preview_target(environment: str, database_url: str) -> None:
    if environment.strip().lower() != "development":
        raise PreviewSafetyError("Preview tooling requires APP_ENV=development.")
    try:
        url = make_url(database_url)
    except Exception as exc:
        raise PreviewSafetyError("DATABASE_URL is not valid.") from exc
    if not url.drivername.startswith("postgresql"):
        raise PreviewSafetyError("Preview tooling requires PostgreSQL.")
    if url.host not in LOCAL_HOSTS:
        raise PreviewSafetyError("Preview tooling requires a loopback database host.")
    if url.database != DATABASE_NAME:
        raise PreviewSafetyError(
            f"Refusing database {url.database!r}; expected disposable {DATABASE_NAME!r}.",
        )


def _normalise_name(name: str) -> str:
    return " ".join(name.strip().lower().split())


def _ensure_game(db, specification: dict) -> Game:
    game = db.query(Game).filter(Game.bgg_id == specification["bgg_id"]).first()
    if game is not None and game.name != specification["name"]:
        raise PreviewSafetyError(
            f"BGG ID {specification['bgg_id']} belongs to {game.name!r}; no data changed.",
        )
    if game is None:
        game = Game(
            **specification,
            best_player_counts=[2],
            recommended_player_counts=list(range(specification["min_players"], specification["max_players"] + 1)),
            player_count_poll=[],
            min_age=10,
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


def _ensure_player(db, user: User, name: str) -> Player:
    normalised = _normalise_name(name)
    player = db.query(Player).filter(
        Player.user_id == user.id,
        Player.normalized_name == normalised,
    ).first()
    if player is None:
        player = Player(
            user_id=user.id,
            name=name,
            normalized_name=normalised,
            avatar_key="forest" if name == "Phone Reviewer" else "meeple",
        )
        db.add(player)
        db.flush()
    return player


def setup_preview(db, password: str) -> None:
    user = db.query(User).filter(User.email == ACCOUNT_EMAIL).first()
    if user is not None and user.bgg_username != ACCOUNT_MARKER:
        raise PreviewSafetyError("Reserved preview email is owned by an unmarked account.")
    if user is None:
        user = User(email=ACCOUNT_EMAIL)
        db.add(user)
        db.flush()

    user.display_name = "SP-SCORE-03A Reviewer"
    user.bgg_username = ACCOUNT_MARKER
    user.password_hash = hash_password(password)
    user.email_verified_at = datetime.now(timezone.utc)
    user.onboarding_completed = True
    user.preferred_player_count = 2
    user.preferred_play_time = 90
    user.preferred_play_style = "any"
    user.tier = "FREE"

    profile = _ensure_player(db, user, "Phone Reviewer")
    _ensure_player(db, user, "Guest Tester")
    user.profile_player_id = profile.id

    for specification in GAMES:
        game = _ensure_game(db, specification)
        membership = db.query(UserGame).filter(
            UserGame.user_id == user.id,
            UserGame.game_id == game.id,
        ).first()
        if membership is None:
            db.add(UserGame(user_id=user.id, game_id=game.id, source="score03a-preview"))
    db.commit()


def _game_has_other_data(db, game: Game) -> bool:
    comparisons = db.query(GameComparison).filter(
        (GameComparison.winner_game_id == game.id)
        | (GameComparison.loser_game_id == game.id),
    )
    return any(query.first() is not None for query in (
        db.query(UserGame).filter(UserGame.game_id == game.id),
        db.query(UserWishlistGame).filter(UserWishlistGame.game_id == game.id),
        db.query(Play).filter(Play.game_id == game.id),
        db.query(LivePlayTimer).filter(LivePlayTimer.game_id == game.id),
        db.query(GameRanking).filter(GameRanking.game_id == game.id),
        comparisons,
    ))


def reset_preview(db) -> None:
    user = db.query(User).filter(User.email == ACCOUNT_EMAIL).first()
    if user is not None:
        if user.bgg_username != ACCOUNT_MARKER:
            raise PreviewSafetyError("Refusing to remove an unmarked account.")
        db.delete(user)
        db.flush()

    for specification in GAMES:
        game = db.query(Game).filter(Game.bgg_id == specification["bgg_id"]).first()
        if game is not None and game.name == specification["name"] and not _game_has_other_data(db, game):
            db.delete(game)
    db.commit()


def print_status(db) -> None:
    user = db.query(User).filter(User.email == ACCOUNT_EMAIL).first()
    state = "missing" if user is None else "present"
    game_count = db.query(Game).filter(Game.bgg_id.in_([game["bgg_id"] for game in GAMES])).count()
    play_count = 0 if user is None else db.query(Play).filter(Play.user_id == user.id).count()
    print(f"Preview account: {state}")
    print(f"Approved games: {game_count}/{len(GAMES)}")
    print(f"Disposable plays: {play_count}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Manage the isolated SP-SCORE-03A review account.")
    parser.add_argument("command", choices=("setup", "status", "reset"))
    command = parser.parse_args().command

    try:
        validate_preview_target(settings.environment, settings.database_url)
    except PreviewSafetyError as exc:
        print(f"Safety check failed: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc

    password = os.getenv("SCORESHEET_PREVIEW_PASSWORD", "")
    if command == "setup" and len(password) < 12:
        print(
            "Set SCORESHEET_PREVIEW_PASSWORD to at least 12 characters.",
            file=sys.stderr,
        )
        raise SystemExit(2)

    db = SessionLocal()
    try:
        if command == "setup":
            setup_preview(db, password)
            print("SP-SCORE-03A preview data is ready.")
            print(f"Email: {ACCOUNT_EMAIL}")
            print("Password: the value supplied in SCORESHEET_PREVIEW_PASSWORD.")
        elif command == "reset":
            reset_preview(db)
            print("SP-SCORE-03A preview account, plays and unreferenced games removed.")
        else:
            print_status(db)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
