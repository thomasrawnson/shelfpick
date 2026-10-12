from datetime import datetime, timezone

from database.connection import SessionLocal
from database.models import (
    Game,
    Play,
    User,
    UserGame,
)
from repositories.insights_repository import InsightsRepository


def test_insights_separate_collection_coverage_from_account_history():
    db = SessionLocal()
    owner_email = "insights-truth-owner@boardgamepicker.local"
    other_email = "insights-truth-other@boardgamepicker.local"
    zero_email = "insights-truth-zero@boardgamepicker.local"
    bgg_ids = [999201, 999202, 999203, 999204]

    try:
        owner = User(email=owner_email, display_name="Insights Truth Owner")
        other = User(email=other_email, display_name="Insights Truth Other")
        zero_user = User(email=zero_email, display_name="Insights Truth Zero")
        alpha = Game(bgg_id=bgg_ids[0], name="Alpha", owned=True)
        beta = Game(bgg_id=bgg_ids[1], name="Beta", owned=False)
        gamma = Game(bgg_id=bgg_ids[2], name="Gamma", owned=False)
        expansion = Game(
            bgg_id=bgg_ids[3],
            name="Alpha Expansion",
            owned=True,
            is_expansion=True,
        )
        db.add_all([owner, other, zero_user, alpha, beta, gamma, expansion])
        db.flush()
        removed_membership = UserGame(user_id=owner.id, game_id=beta.id)
        db.add_all([
            UserGame(user_id=owner.id, game_id=alpha.id),
            removed_membership,
            UserGame(user_id=owner.id, game_id=expansion.id),
            UserGame(user_id=other.id, game_id=alpha.id),
        ])
        latest = datetime(2026, 10, 4, 20, tzinfo=timezone.utc)
        db.add_all([
            Play(
                user_id=owner.id,
                game_id=alpha.id,
                player_count=2,
                played_at=datetime(2026, 10, 1, 20, tzinfo=timezone.utc),
                duration_minutes=None,
            ),
            Play(
                user_id=owner.id,
                game_id=alpha.id,
                player_count=2,
                played_at=datetime(2026, 10, 2, 20, tzinfo=timezone.utc),
                duration_minutes=0,
            ),
            Play(
                user_id=owner.id,
                game_id=beta.id,
                player_count=2,
                played_at=latest,
                duration_minutes=60,
            ),
            Play(
                user_id=owner.id,
                game_id=gamma.id,
                player_count=2,
                played_at=latest,
                duration_minutes=None,
            ),
            Play(
                user_id=owner.id,
                game_id=expansion.id,
                player_count=2,
                played_at=datetime(2026, 10, 3, 20, tzinfo=timezone.utc),
                duration_minutes=None,
            ),
            Play(
                user_id=other.id,
                game_id=alpha.id,
                player_count=1,
                played_at=datetime(2026, 10, 5, 20, tzinfo=timezone.utc),
                duration_minutes=None,
            ),
            Play(
                user_id=zero_user.id,
                game_id=gamma.id,
                player_count=1,
                played_at=datetime(2026, 10, 6, 20, tzinfo=timezone.utc),
                duration_minutes=0,
            ),
        ])
        db.commit()

        # Removing a game from Owned must not remove its recorded history.
        db.delete(removed_membership)
        db.commit()

        owner_repository = InsightsRepository(db, owner.id)
        other_repository = InsightsRepository(db, other.id)
        zero_repository = InsightsRepository(db, zero_user.id)

        assert owner_repository.total_owned_games() == 1
        assert owner_repository.played_games_count() == 1
        assert owner_repository.historical_played_games_count() == 4
        assert owner_repository.total_plays() == 5
        assert owner_repository.total_duration_minutes() == 60
        assert owner_repository.duration_plays() == 2
        assert owner_repository.average_duration_minutes() == 30
        assert owner_repository.get_most_played().name == "Alpha"
        assert owner_repository.get_most_played().play_count == 2
        assert owner_repository.get_last_played().name == "Gamma"

        assert other_repository.total_plays() == 1
        assert other_repository.historical_played_games_count() == 1
        assert other_repository.total_duration_minutes() is None
        assert other_repository.duration_plays() == 0
        assert other_repository.get_last_played().played_at.date().isoformat() == "2026-10-05"

        assert zero_repository.total_plays() == 1
        assert zero_repository.total_duration_minutes() == 0
        assert zero_repository.duration_plays() == 1
        assert zero_repository.average_duration_minutes() == 0
    finally:
        users = db.query(User).filter(
            User.email.in_([owner_email, other_email, zero_email])
        ).all()
        user_ids = [user.id for user in users]
        if user_ids:
            db.query(Play).filter(Play.user_id.in_(user_ids)).delete(synchronize_session=False)
            db.query(UserGame).filter(UserGame.user_id.in_(user_ids)).delete(synchronize_session=False)
            db.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
        db.query(Game).filter(Game.bgg_id.in_(bgg_ids)).delete(synchronize_session=False)
        db.commit()
        db.close()
