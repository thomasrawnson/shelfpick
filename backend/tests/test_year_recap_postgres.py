from datetime import datetime, timezone
from time import perf_counter

import pytest

from database.connection import SessionLocal
from database.models import Game, Play, PlayParticipant, Player, User
from services.insights_service import InsightsService
from repositories.insights_repository import InsightsRepository


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def _suffix():
    return datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")


def _user(db, label):
    user = User(email=f"yir-{label}-{_suffix()}@example.com")
    db.add(user)
    db.flush()
    return user


def _games(db, names):
    base = 1_000_000_000 + int(_suffix()[-8:]) % 900_000_000
    games = [Game(bgg_id=base + i, name=name) for i, name in enumerate(names)]
    db.add_all(games)
    db.flush()
    return games


def _recap(db, user, year=2026, tz="Europe/London"):
    return InsightsService(InsightsRepository(db, user.id)).get_year_recap(year, tz)


def _cleanup(db, *users):
    for user in users:
        db.query(Play).filter(Play.user_id == user.id).delete()
        db.query(Player).filter(Player.user_id == user.id).delete()
        db.delete(user)
    db.commit()


def test_empty_year_returns_zeroed_recap(db):
    user = _user(db, "empty")
    db.commit()
    try:
        recap = _recap(db, user)
        assert recap.total_plays == 0
        assert recap.total_duration_minutes is None
        assert recap.top_games == []
        assert recap.plays_by_month == [0] * 12
        assert recap.busiest_month is None
        assert recap.busiest_weekday is None
        assert recap.longest_play is None
        assert recap.co_players == []
    finally:
        _cleanup(db, user)


def test_year_bounds_use_the_users_timezone(db):
    user = _user(db, "tz")
    (game,) = _games(db, ["Tz Game"])
    db.add_all(
        [
            # 31 Dec 2025 23:30 UTC is already 1 Jan 2026 in Auckland, not in London.
            Play(user_id=user.id, game_id=game.id, player_count=2,
                 played_at=datetime(2025, 12, 31, 23, 30, tzinfo=timezone.utc)),
            # 31 Dec 2026 23:30 London (winter, = UTC) is the last minute of 2026.
            Play(user_id=user.id, game_id=game.id, player_count=2,
                 played_at=datetime(2026, 12, 31, 23, 30, tzinfo=timezone.utc)),
            # 1 Jan 2027 00:00 London is outside 2026.
            Play(user_id=user.id, game_id=game.id, player_count=2,
                 played_at=datetime(2027, 1, 1, 0, 0, tzinfo=timezone.utc)),
        ]
    )
    db.commit()
    try:
        london = _recap(db, user, tz="Europe/London")
        assert london.total_plays == 1
        assert london.plays_by_month[11] == 1
        assert london.busiest_month == 12
        auckland = _recap(db, user, tz="Pacific/Auckland")
        # Auckland 2026 = 31 Dec 2025 11:00 UTC .. 31 Dec 2026 11:00 UTC.
        assert auckland.total_plays == 1
        assert auckland.plays_by_month[0] == 1
        assert _recap(db, user, year=2027, tz="Europe/London").total_plays == 1
    finally:
        _cleanup(db, user)


def test_year_recap_totals_new_games_weekday_longest_and_players(db):
    user = _user(db, "full")
    old, fresh_a, fresh_b, *_ = _games(db, ["Old Favourite", "Fresh A", "fresh b"])
    ann = Player(user_id=user.id, name="Ann", normalized_name=f"ann{_suffix()}")
    bob = Player(user_id=user.id, name="Bob", normalized_name=f"bob{_suffix()}")
    db.add_all([ann, bob])
    db.flush()

    def play(game, when, minutes=None, source="app"):
        item = Play(user_id=user.id, game_id=game.id, player_count=2,
                    played_at=when, duration_minutes=minutes, source=source)
        db.add(item)
        db.flush()
        return item

    play(old, datetime(2025, 6, 1, 12, tzinfo=timezone.utc))  # before the year
    p1 = play(old, datetime(2026, 3, 7, 12, tzinfo=timezone.utc), 60)  # Saturday
    p2 = play(fresh_a, datetime(2026, 3, 14, 12, tzinfo=timezone.utc), 120)  # Saturday
    p3 = play(fresh_a, datetime(2026, 5, 4, 12, tzinfo=timezone.utc))  # Monday
    play(fresh_b, datetime(2026, 5, 5, 12, tzinfo=timezone.utc), source="bgstats")
    for item, players in ((p1, [ann, bob]), (p2, [ann]), (p3, [ann, bob])):
        for player in players:
            db.add(PlayParticipant(play_id=item.id, name=player.name,
                                   player_id=player.id, is_winner=False))
    db.commit()
    try:
        recap = _recap(db, user)
        assert recap.total_plays == 4  # imported (bgstats) play counted
        assert recap.unique_games == 3
        assert recap.total_duration_minutes == 180
        assert recap.duration_plays == 2
        assert [g.name for g in recap.top_games] == ["Fresh A", "fresh b", "Old Favourite"]
        assert recap.new_games_count == 2
        assert [g.name for g in recap.new_games] == ["Fresh A", "fresh b"]
        assert recap.plays_by_month[2] == 2 and recap.plays_by_month[4] == 2
        assert recap.busiest_month == 3  # tie March/May -> earliest
        assert recap.plays_by_weekday[5] == 2  # Saturday (Mon=0)
        assert recap.busiest_weekday == 6  # ISO weekday, Saturday
        assert recap.longest_play.name == "Fresh A"
        assert recap.longest_play.duration_minutes == 120
        assert recap.longest_play.played_on == "2026-03-14"
        assert [(p.name, p.play_count) for p in recap.co_players] == [("Ann", 3), ("Bob", 2)]
    finally:
        db.query(PlayParticipant).filter(PlayParticipant.player_id.in_([ann.id, bob.id])).delete()
        _cleanup(db, user)


def test_one_play_year_and_deterministic_ties(db):
    user = _user(db, "one")
    alpha, beta, gamma = _games(db, ["Gamma", "alpha", "Beta"])
    db.add(Play(user_id=user.id, game_id=alpha.id, player_count=1,
                played_at=datetime(2026, 7, 1, 12, tzinfo=timezone.utc)))
    db.commit()
    try:
        recap = _recap(db, user)
        assert recap.total_plays == 1
        assert recap.longest_play is None  # no timed play
        assert recap.busiest_month == 7
        assert recap.co_players == []
        # Ties on plays and last played order by name, then bgg id.
        same = datetime(2026, 8, 1, 12, tzinfo=timezone.utc)
        db.add_all([Play(user_id=user.id, game_id=g.id, player_count=1, played_at=same)
                    for g in (beta, gamma)])
        db.commit()
        again = _recap(db, user)
        assert [g.name for g in again.top_games] == ["alpha", "Beta", "Gamma"]
        assert [g.name for g in again.top_games] == [g.name for g in _recap(db, user).top_games]
    finally:
        _cleanup(db, user)


def test_year_recap_is_account_scoped(db):
    owner = _user(db, "owner")
    other = _user(db, "other")
    (game,) = _games(db, ["Shared"])
    db.add_all([
        Play(user_id=owner.id, game_id=game.id, player_count=1,
             played_at=datetime(2026, 2, 1, 12, tzinfo=timezone.utc)),
        Play(user_id=other.id, game_id=game.id, player_count=1,
             played_at=datetime(2026, 2, 2, 12, tzinfo=timezone.utc), duration_minutes=500),
        Play(user_id=other.id, game_id=game.id, player_count=1,
             played_at=datetime(2026, 2, 3, 12, tzinfo=timezone.utc)),
    ])
    db.commit()
    try:
        recap = _recap(db, owner)
        assert recap.total_plays == 1
        assert recap.total_duration_minutes is None
        assert recap.longest_play is None
        assert recap.top_games[0].play_count == 1
    finally:
        _cleanup(db, owner, other)


def test_year_recap_with_5000_plays_answers_quickly(db):
    user = _user(db, "perf")
    games = _games(db, [f"Perf {i}" for i in range(40)])
    db.add_all([
        Play(user_id=user.id, game_id=games[i % 40].id, player_count=3,
             played_at=datetime(2026, 1 + i % 12, 1 + i % 28, 12, tzinfo=timezone.utc),
             duration_minutes=20 + i % 90)
        for i in range(5000)
    ])
    db.commit()
    try:
        service = InsightsService(InsightsRepository(db, user.id))
        service.get_year_recap(2026, "Europe/London")  # warm up
        started = perf_counter()
        recap = service.get_year_recap(2026, "Europe/London")
        elapsed_ms = (perf_counter() - started) * 1000
        assert recap.total_plays == 5000
        assert elapsed_ms < 500, f"{elapsed_ms:.0f} ms"
    finally:
        _cleanup(db, user)
