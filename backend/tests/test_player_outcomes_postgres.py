from datetime import datetime, timedelta, timezone

from database.connection import SessionLocal
from database.models import (
    Game,
    Mechanic,
    Play as DatabasePlay,
    PlayParticipant,
    Player,
    User,
    UserGame,
)
from repositories.play_repository import PlayRepository


def test_player_stats_use_only_determinable_outcomes_for_win_rate():
    db = SessionLocal()
    email = "player-outcomes@boardgamepicker.local"
    bgg_ids = [999211, 999212]
    cooperative_mechanic_created = False

    try:
        user = User(email=email, display_name="Player Outcomes")
        competitive = Game(bgg_id=bgg_ids[0], name="Outcome Competitive", owned=True)
        cooperative = Game(bgg_id=bgg_ids[1], name="Outcome Cooperative", owned=True)
        mechanic = db.query(Mechanic).filter(Mechanic.name == "Cooperative Game").first()
        if mechanic is None:
            mechanic = Mechanic(name="Cooperative Game")
            db.add(mechanic)
            cooperative_mechanic_created = True
        cooperative.mechanics.append(mechanic)
        db.add_all([user, competitive, cooperative])
        db.flush()
        db.add_all([
            UserGame(user_id=user.id, game_id=competitive.id),
            UserGame(user_id=user.id, game_id=cooperative.id),
        ])
        db.commit()

        repository = PlayRepository(db, user.id)
        start = datetime(2026, 10, 1, 20, tzinfo=timezone.utc)
        scenarios = [
            (bgg_ids[0], [{"name": "Alex", "score": 10, "is_winner": True}, {"name": "Sam", "score": 5, "is_winner": False}]),
            (bgg_ids[0], [{"name": "Alex", "score": 5, "is_winner": False}, {"name": "Sam", "score": 10, "is_winner": True}]),
            (bgg_ids[0], [{"name": "Alex", "score": 10, "is_winner": True}, {"name": "Sam", "score": 10, "is_winner": True}]),
            (bgg_ids[0], [{"name": "Alex", "score": None, "is_winner": False}, {"name": "Sam", "score": None, "is_winner": False}]),
            (bgg_ids[0], [{"name": "Alex", "score": 10, "is_winner": True}, {"name": "Sam", "score": 8, "is_winner": True}]),
            (bgg_ids[1], [{"name": "Alex", "score": 10, "is_winner": True}, {"name": "Sam", "score": 10, "is_winner": True}]),
            (bgg_ids[0], [{"name": "Unknown Only", "score": None, "is_winner": False}, {"name": "Legacy Player", "score": None, "is_winner": False}]),
        ]
        for index, (bgg_id, participants) in enumerate(scenarios):
            repository.create(
                bgg_id=bgg_id,
                played_at=start + timedelta(days=index),
                duration_minutes=None,
                participants=participants,
            )

        players = {player["name"]: player for player in repository.get_players()}
        alex = repository.get_player_stats(players["Alex"]["id"])
        unknown_only = repository.get_player_stats(players["Unknown Only"]["id"])

        assert alex is not None
        assert alex["wins"] == 3
        assert alex["losses"] == 1
        assert alex["draws"] == 1
        assert alex["unknown_results"] == 1
        assert alex["decided_plays"] == 5
        assert alex["win_rate"] == 60.0
        assert {play["outcome"] for play in alex["recent_games"]} == {
            "win", "loss", "draw", "unknown"
        }

        assert unknown_only is not None
        assert unknown_only["unknown_results"] == 1
        assert unknown_only["decided_plays"] == 0
        assert unknown_only["win_rate"] is None
    finally:
        user = db.query(User).filter(User.email == email).first()
        if user is not None:
            play_ids = db.query(DatabasePlay.id).filter(DatabasePlay.user_id == user.id)
            db.query(PlayParticipant).filter(PlayParticipant.play_id.in_(play_ids)).delete(synchronize_session=False)
            db.query(DatabasePlay).filter(DatabasePlay.user_id == user.id).delete(synchronize_session=False)
            db.query(Player).filter(Player.user_id == user.id).delete(synchronize_session=False)
            db.query(UserGame).filter(UserGame.user_id == user.id).delete(synchronize_session=False)
            db.delete(user)
        db.query(Game).filter(Game.bgg_id.in_(bgg_ids)).delete(synchronize_session=False)
        if cooperative_mechanic_created:
            mechanic = db.query(Mechanic).filter(Mechanic.name == "Cooperative Game").first()
            if mechanic is not None:
                db.delete(mechanic)
        db.commit()
        db.close()
