from datetime import (
    datetime,
    timezone,
)

from database.connection import (
    SessionLocal,
)
from database.models import (
    Game as DatabaseGame,
    Play as DatabasePlay,
    PlayParticipant,
    Player,
    User,
    UserGame,
)
from repositories.play_repository import (
    PlayRepository,
)


TEST_USER_EMAIL = (
    "player-stats-test@boardgamepicker.local"
)

TEST_GAME_ONE_BGG_ID = 999101
TEST_GAME_TWO_BGG_ID = 999102


def test_get_player_stats():
    db = SessionLocal()

    try:
        user = User(
            email=TEST_USER_EMAIL,
            display_name="Player Stats Test",
        )

        db.add(user)
        db.flush()

        game_one = DatabaseGame(
            bgg_id=TEST_GAME_ONE_BGG_ID,
            name="Player Stats Game One",
            owned=True,
        )

        game_two = DatabaseGame(
            bgg_id=TEST_GAME_TWO_BGG_ID,
            name="Player Stats Game Two",
            owned=True,
        )

        db.add_all(
            [
                game_one,
                game_two,
            ]
        )

        db.flush()

        db.add_all(
            [
                UserGame(
                    user_id=user.id,
                    game_id=game_one.id,
                ),
                UserGame(
                    user_id=user.id,
                    game_id=game_two.id,
                ),
            ]
        )

        db.commit()

        repository = PlayRepository(
            db,
            user_id=user.id,
        )

        repository.create(
            bgg_id=TEST_GAME_ONE_BGG_ID,
            played_at=datetime(
                2026,
                8,
                1,
                20,
                0,
                tzinfo=timezone.utc,
            ),
            duration_minutes=60,
            participants=[
                {
                    "name": "Alex",
                    "score": 20,
                    "is_winner": False,
                },
                {
                    "name": "Tom",
                    "score": 30,
                    "is_winner": True,
                },
            ],
        )

        repository.create(
            bgg_id=TEST_GAME_ONE_BGG_ID,
            played_at=datetime(
                2026,
                8,
                15,
                20,
                0,
                tzinfo=timezone.utc,
            ),
            duration_minutes=70,
            participants=[
                {
                    "name": "Alex",
                    "score": 40,
                    "is_winner": True,
                },
                {
                    "name": "Tom",
                    "score": 35,
                    "is_winner": False,
                },
            ],
        )

        repository.create(
            bgg_id=TEST_GAME_TWO_BGG_ID,
            played_at=datetime(
                2026,
                9,
                1,
                20,
                0,
                tzinfo=timezone.utc,
            ),
            duration_minutes=45,
            participants=[
                {
                    "name": "Alex",
                    "score": 15,
                    "is_winner": False,
                },
                {
                    "name": "Charlie",
                    "score": 25,
                    "is_winner": True,
                },
            ],
        )

        players = (
            repository.get_players()
        )

        alex = next(
            player
            for player in players
            if player["name"] == "Alex"
        )

        stats = (
            repository.get_player_stats(
                alex["id"]
            )
        )

        discover_profile = repository.get_discover_profile()

        assert discover_profile == {
            "typical_player_count": 2,
            "typical_play_time": 60,
            "player_count_source": "history",
            "play_time_source": "history",
        }

        assert stats is not None

        assert stats["player"] == {
            "id": alex["id"],
            "name": "Alex",
        }

        assert (
            stats["total_plays"]
            == 3
        )

        assert (
            stats["unique_games"]
            == 2
        )

        assert (
            stats["wins"]
            == 1
        )

        assert stats["losses"] == 2
        assert stats["draws"] == 0
        assert stats["unknown_results"] == 0
        assert stats["decided_plays"] == 3

        assert (
            stats["win_rate"]
            == 33.3
        )

        assert (
            stats[
                "most_played_games"
            ][0]["bgg_id"]
            == TEST_GAME_ONE_BGG_ID
        )

        assert (
            stats[
                "most_played_games"
            ][0]["play_count"]
            == 2
        )

        assert (
            stats[
                "recent_games"
            ][0]["bgg_id"]
            == TEST_GAME_TWO_BGG_ID
        )

        assert (
            stats[
                "recent_games"
            ][0]["is_winner"]
            is False
        )

        assert (
            stats[
                "common_partners"
            ][0]["name"]
            == "Tom"
        )

        assert (
            stats[
                "common_partners"
            ][0]["play_count"]
            == 2
        )

    finally:
        user = (
            db.query(User)
            .filter(
                User.email
                == TEST_USER_EMAIL
            )
            .first()
        )

        if user is not None:
            db.query(PlayParticipant).filter(
                PlayParticipant.play_id.in_(
                    db.query(DatabasePlay.id).filter(DatabasePlay.user_id == user.id)
                )
            ).delete(synchronize_session=False)
            db.query(
                DatabasePlay
            ).filter(
                DatabasePlay.user_id
                == user.id
            ).delete(
                synchronize_session=False
            )

            db.query(
                Player
            ).filter(
                Player.user_id
                == user.id
            ).delete(
                synchronize_session=False
            )

            db.query(
                UserGame
            ).filter(
                UserGame.user_id
                == user.id
            ).delete(
                synchronize_session=False
            )

            db.delete(user)

        db.query(
            DatabaseGame
        ).filter(
            DatabaseGame.bgg_id.in_(
                [
                    TEST_GAME_ONE_BGG_ID,
                    TEST_GAME_TWO_BGG_ID,
                ]
            )
        ).delete(
            synchronize_session=False
        )

        db.commit()
        db.close()


def test_get_player_stats_returns_none_for_unknown_player():
    db = SessionLocal()

    try:
        user = User(
            email=(
                "missing-player-test"
                "@boardgamepicker.local"
            ),
            display_name="Missing Player Test",
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        repository = PlayRepository(
            db,
            user_id=user.id,
        )

        result = (
            repository.get_player_stats(
                999999999
            )
        )

        assert result is None

    finally:
        db.query(User).filter(
            User.email
            == (
                "missing-player-test"
                "@boardgamepicker.local"
            )
        ).delete(
            synchronize_session=False
        )

        db.commit()
        db.close()


def test_group_stats_require_the_exact_participant_set():
    db = SessionLocal()
    email = "exact-group-test@boardgamepicker.local"
    bgg_id = 999103

    try:
        user = User(email=email, display_name="Exact Group Test")
        game = DatabaseGame(bgg_id=bgg_id, name="Exact Group Game", owned=True)
        db.add_all([user, game])
        db.flush()
        db.add(UserGame(user_id=user.id, game_id=game.id))
        db.commit()

        repository = PlayRepository(db, user_id=user.id)
        repository.create(
            bgg_id=bgg_id,
            played_at=datetime(2026, 9, 1, tzinfo=timezone.utc),
            duration_minutes=45,
            participants=[
                {"name": "Alex", "score": None, "is_winner": False},
                {"name": "Tom", "score": None, "is_winner": False},
            ],
        )
        repository.create(
            bgg_id=bgg_id,
            played_at=datetime(2026, 9, 2, tzinfo=timezone.utc),
            duration_minutes=45,
            participants=[
                {"name": "Alex", "score": None, "is_winner": False},
                {"name": "Tom", "score": None, "is_winner": False},
                {"name": "Chris", "score": None, "is_winner": False},
            ],
        )

        player_ids = {
            player["name"]: player["id"]
            for player in repository.get_players()
        }
        stats = repository.get_group_game_play_stats(
            [player_ids["Alex"], player_ids["Tom"]]
        )

        assert stats[bgg_id].play_count == 1
        assert stats[bgg_id].last_played_at.date().isoformat() == "2026-09-01"
    finally:
        user = db.query(User).filter(User.email == email).first()
        if user is not None:
            db.query(PlayParticipant).filter(
                PlayParticipant.play_id.in_(
                    db.query(DatabasePlay.id).filter(DatabasePlay.user_id == user.id)
                )
            ).delete(synchronize_session=False)
            db.query(DatabasePlay).filter(DatabasePlay.user_id == user.id).delete(synchronize_session=False)
            db.query(Player).filter(Player.user_id == user.id).delete(synchronize_session=False)
            db.query(UserGame).filter(UserGame.user_id == user.id).delete(synchronize_session=False)
            db.delete(user)
        db.query(DatabaseGame).filter(DatabaseGame.bgg_id == bgg_id).delete(synchronize_session=False)
        db.commit()
        db.close()
