from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from database.connection import Base
from database.models import (
    Game,
    GameComparison,
    Category,
    Mechanic,
    Play,
    User,
    UserGame,
)
from repositories.ranking_repository import (
    RankingRepository,
)


def test_rankings_are_user_scoped_and_reversible():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:"
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)

    with session_factory() as db:
        user = User(email="rank@example.com")
        other_user = User(
            email="other-rank@example.com"
        )
        first = Game(
            bgg_id=101,
            name="First Game",
            is_expansion=False,
            designers=["Alex Designer"],
            publishers=["Small Publisher"],
            categories=[Category(name="Strategy")],
            mechanics=[Mechanic(name="Drafting")],
        )
        second = Game(
            bgg_id=102,
            name="Second Game",
            is_expansion=False,
        )
        expansion = Game(
            bgg_id=103,
            name="Expansion",
            is_expansion=True,
        )
        db.add_all([
            user,
            other_user,
            first,
            second,
            expansion,
        ])
        db.flush()
        db.add_all([
            UserGame(
                user_id=user.id,
                game_id=first.id,
                source="manual",
            ),
            UserGame(
                user_id=user.id,
                game_id=second.id,
                source="manual",
            ),
            UserGame(
                user_id=user.id,
                game_id=expansion.id,
                source="manual",
            ),
            UserGame(
                user_id=other_user.id,
                game_id=first.id,
                source="manual",
            ),
            Play(
                user_id=user.id,
                game_id=first.id,
                player_count=2,
            ),
            Play(
                user_id=user.id,
                game_id=second.id,
                player_count=2,
            ),
        ])
        db.commit()

        repository = RankingRepository(
            db,
            user_id=user.id,
        )

        matchup = repository.get_matchup()

        assert {
            game["bgg_id"]
            for game in matchup
        } == {101, 102}

        comparison = (
            repository.record_comparison(
                winner_bgg_id=101,
                loser_bgg_id=102,
            )
        )

        assert comparison is not None
        assert comparison["winner"]["rating"] > 1500
        assert comparison["loser"]["rating"] < 1500

        rankings = repository.get_rankings()

        assert [
            game["bgg_id"]
            for game in rankings["rankings"]
        ] == [101, 102]
        assert rankings["rankings"][0]["rank"] == 1
        assert rankings["summary"]["games_count"] == 2
        assert rankings["summary"]["designers"] == [
            {"name": "Alex Designer", "count": 1}
        ]
        assert rankings["summary"]["mechanics"] == [
            {"name": "Drafting", "count": 1}
        ]

        affinity_games = repository.get_discover_affinity_games()
        assert [game["bgg_id"] for game in affinity_games] == [101, 102]
        assert affinity_games[0]["categories"] == ["Strategy"]
        assert affinity_games[0]["mechanics"] == ["Drafting"]

        limited_summary = repository.get_rankings(
            summary_limit=1
        )["summary"]
        assert limited_summary["games_count"] == 1

        comparisons = list(
            db.scalars(
                select(GameComparison)
            )
        )

        assert len(comparisons) == 1
        assert comparisons[0].user_id == user.id

        assert repository.set_unplayed(
            101,
            True,
        ) is True

        assert [
            game["bgg_id"]
            for game in repository.get_discover_affinity_games()
        ] == [102]

        rankings = repository.get_rankings()
        assert [
            game["bgg_id"]
            for game in rankings["unplayed"]
        ] == [101]

        assert repository.set_unplayed(
            101,
            False,
        ) is True

        assert (
            repository.get_rankings()[
                "unplayed"
            ]
            == []
        )

        other_repository = RankingRepository(
            db,
            user_id=other_user.id,
        )

        assert (
            other_repository.get_rankings()[
                "rankings"
            ]
            == []
        )
        assert other_repository.get_discover_affinity_games() == []


def test_played_only_requires_one_recorded_play():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:"
    )
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)

    with session_factory() as db:
        user = User(email="played-filter@example.com")
        played = Game(
            bgg_id=201,
            name="Played Game",
            is_expansion=False,
        )
        unplayed = Game(
            bgg_id=202,
            name="Unplayed Game",
            is_expansion=False,
        )
        db.add_all([user, played, unplayed])
        db.flush()
        db.add_all([
            UserGame(
                user_id=user.id,
                game_id=played.id,
                source="manual",
            ),
            UserGame(
                user_id=user.id,
                game_id=unplayed.id,
                source="manual",
            ),
            Play(
                user_id=user.id,
                game_id=played.id,
                player_count=2,
            ),
        ])
        db.commit()

        repository = RankingRepository(db, user.id)

        assert [
            game["bgg_id"]
            for game in repository.get_matchup()
        ] == [201]
        assert {
            game["bgg_id"]
            for game in repository.get_matchup(
                played_only=False
            )
        } == {201, 202}
