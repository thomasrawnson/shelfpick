from datetime import datetime, timezone

from database.connection import SessionLocal
from database.models import Game, Play, User
from repositories.insights_repository import InsightsRepository


def test_monthly_recap_is_account_scoped_bounded_and_deterministic():
    db = SessionLocal()
    suffix = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    owner = User(email=f"recap-owner-{suffix}@example.com")
    other = User(email=f"recap-other-{suffix}@example.com")
    games = [
        Game(bgg_id=int(f"81{suffix[-6:]}{index}"), name=name, image_url=image)
        for index, (name, image) in enumerate(
            [
                ("Alpha", "https://example.com/a.jpg"),
                ("beta", "https://example.com/b.jpg"),
                ("Gamma", None),
                ("Delta", None),
                ("Epsilon", None),
            ],
            start=1,
        )
    ]
    db.add_all([owner, other, *games])
    db.flush()
    plays = []
    for index in range(21):
        game = games[index % 5]
        plays.append(
            Play(
                user_id=owner.id,
                game_id=game.id,
                player_count=2,
                played_at=datetime(2026, 10, 2 + index, 12, tzinfo=timezone.utc),
                duration_minutes=30 if index % 2 == 0 else None,
            )
        )
    plays.extend(
        [
            Play(
                user_id=owner.id,
                game_id=games[0].id,
                player_count=1,
                played_at=datetime(2026, 11, 1, tzinfo=timezone.utc),
            ),
            Play(
                user_id=other.id,
                game_id=games[0].id,
                player_count=1,
                played_at=datetime(2026, 10, 15, tzinfo=timezone.utc),
            ),
        ]
    )
    db.add_all(plays)
    db.commit()

    try:
        result = InsightsRepository(db, owner.id).get_monthly_recap(
            datetime(2026, 10, 1, tzinfo=timezone.utc),
            datetime(2026, 11, 1, tzinfo=timezone.utc),
        )
        repeat = InsightsRepository(db, owner.id).get_monthly_recap(
            datetime(2026, 10, 1, tzinfo=timezone.utc),
            datetime(2026, 11, 1, tzinfo=timezone.utc),
        )

        assert result["total_plays"] == 21
        assert result["unique_games"] == 5
        assert result["duration_plays"] == 11
        assert result["total_duration_minutes"] == 330
        assert len(result["games"]) == 4
        assert [game.bgg_id for game in result["games"]] == [
            game.bgg_id for game in repeat["games"]
        ]
        assert [game.name for game in result["games"]] == [
            "Alpha",
            "Epsilon",
            "Delta",
            "Gamma",
        ]
    finally:
        db.query(Play).filter(Play.user_id.in_([owner.id, other.id])).delete(
            synchronize_session=False
        )
        db.query(Game).filter(Game.id.in_([game.id for game in games])).delete(
            synchronize_session=False
        )
        db.query(User).filter(User.id.in_([owner.id, other.id])).delete()
        db.commit()
        db.close()
