"""SP-STATS-01 aggregates against PostgreSQL: charts, streaks, records,
head-to-head, filters, entitlements and the 10,000-play budget."""

import uuid
from datetime import date, datetime, timedelta, timezone
from time import perf_counter

import pytest
from fastapi.testclient import TestClient

from api.current_user import get_current_user
from api.main import app
from database.connection import SessionLocal, get_db
from database.models import (
    Game,
    Mechanic,
    Play,
    PlayParticipant,
    Player,
    Scoresheet,
    ScoresheetVersion,
    User,
)
from repositories.stats_repository import StatsRepository
from services.stats_service import StatsService

UTC = timezone.utc
NZ = "Pacific/Auckland"
LON = "Europe/London"


def at(year, month, day, hour=12, minute=0):
    return datetime(year, month, day, hour, minute, tzinfo=UTC)


class World:
    """Throwaway accounts, games and plays for one test."""

    def __init__(self, db):
        self.db = db
        self.tag = uuid.uuid4().hex[:10]
        self.users = []
        self._games = 0
        base = 1_200_000_000 + int(uuid.uuid4().int % 700_000_000)
        self._bgg = base

    def user(self, tier="PRO"):
        user = User(email=f"stats-{self.tag}-{len(self.users)}@example.com", tier=tier)
        self.db.add(user)
        self.db.flush()
        self.users.append(user)
        return user

    def player(self, user, name):
        player = Player(user_id=user.id, name=name, normalized_name=name.casefold())
        self.db.add(player)
        self.db.flush()
        return player

    def game(self, name, coop=False, expansion=False):
        self._bgg += 1
        game = Game(bgg_id=self._bgg, name=f"{name} {self.tag}", is_expansion=expansion)
        self.db.add(game)
        self.db.flush()
        if coop:
            mechanic = self.db.query(Mechanic).filter_by(name="Cooperative Game").first()
            if mechanic is None:
                mechanic = Mechanic(name="Cooperative Game")
                self.db.add(mechanic)
                self.db.flush()
            game.mechanics.append(mechanic)
            self.db.flush()
        return game

    def play(
        self, user, game, played_at, people=(), outcome_type="competitive",
        coop_result=None, location=None, player_count=None, source="app",
        scoresheet=None, scoresheet_version=None,
    ):
        play = Play(
            user_id=user.id, game_id=game.id, played_at=played_at,
            player_count=player_count or max(len(people), 1),
            location=location, outcome_type=outcome_type,
            coop_result=coop_result, source=source,
            scoresheet_id=scoresheet.id if scoresheet else None,
            scoresheet_version=scoresheet_version,
        )
        self.db.add(play)
        self.db.flush()
        for person in people:
            self.db.add(
                PlayParticipant(
                    play_id=play.id,
                    name=person["player"].name,
                    player_id=person["player"].id,
                    score=person.get("score"),
                    rank=person.get("rank"),
                    team=person.get("team"),
                    is_winner=person.get("win", False),
                    score_breakdown=person.get("breakdown"),
                )
            )
        self.db.flush()
        return play

    def cleanup(self):
        self.db.rollback()
        for user in self.users:
            self.db.query(Play).filter(Play.user_id == user.id).delete()
            self.db.query(Player).filter(Player.user_id == user.id).delete()
            self.db.query(Scoresheet).filter(Scoresheet.owner_user_id == user.id).delete()
        for user in self.users:
            self.db.query(User).filter(User.id == user.id).delete()
        self.db.query(Game).filter(Game.name.like(f"% {self.tag}")).delete(synchronize_session=False)
        self.db.commit()


@pytest.fixture
def world():
    db = SessionLocal()
    world = World(db)
    try:
        yield world
    finally:
        world.cleanup()
        db.close()


def service(world, user):
    return StatsService(StatsRepository(world.db, user.id))


def flt(svc, tz="UTC", **kwargs):
    return svc.build_filters(tz, **kwargs)


# ---- H-index --------------------------------------------------------- #


def test_h_index_from_plays_including_imported_and_other_accounts(world):
    me, other = world.user(), world.user()
    ann = world.player(me, "Ann")
    games = [world.game(name) for name in ("A", "B", "C", "D")]
    for index, game in enumerate(games):
        for n in range(3 - (index == 3) * 2):
            source = "bgstats" if n == 1 else "app"
            world.play(me, game, at(2026, 1, 1 + n), [{"player": ann}], source=source)
    # Another account's plays never count.
    stranger = world.player(other, "Zed")
    for n in range(9):
        world.play(other, games[0], at(2026, 2, 1 + n), [{"player": stranger}])
    world.db.commit()
    svc = service(world, me)
    result = svc.h_index(flt(svc))
    assert result["h_index"] == 3
    assert result["games_played"] == 4
    assert result["total_plays"] == 10
    assert result["raise_list"][0]["plays_needed"] >= 1


def test_h_index_with_no_plays_is_zero(world):
    me = world.user()
    world.db.commit()
    svc = service(world, me)
    result = svc.h_index(flt(svc))
    assert (result["h_index"], result["raise_list"]) == (0, [])


# ---- charts and timezones --------------------------------------------- #


def test_plays_per_month_is_zero_filled_and_uses_the_local_month(world):
    me = world.user()
    ann = world.player(me, "Ann")
    game = world.game("A")
    # 28 Feb 23:30 UTC is already 1 March in Auckland.
    world.play(me, game, at(2026, 2, 28, 23, 30), [{"player": ann}])
    world.play(me, game, at(2026, 3, 10), [{"player": ann}])
    world.db.commit()
    svc = service(world, me)
    now = at(2026, 5, 15)
    london = svc.plays_per_month(flt(svc, LON), 12, now)
    auckland = svc.plays_per_month(flt(svc, NZ), 12, now)
    assert len(london["months"]) == 12
    assert london["months"][0]["month"] == "2025-06"
    assert london["months"][-1] == {"month": "2026-05", "plays": 0}
    by_month = {m["month"]: m["plays"] for m in london["months"]}
    assert (by_month["2026-02"], by_month["2026-03"]) == (1, 1)
    nz = {m["month"]: m["plays"] for m in auckland["months"]}
    assert (nz["2026-02"], nz["2026-03"]) == (0, 2)
    assert len(svc.plays_per_month(flt(svc, LON), 24, now)["months"]) == 24
    with pytest.raises(ValueError):
        svc.plays_per_month(flt(svc, LON), 6, now)


def test_heatmap_counts_local_days(world):
    me = world.user()
    ann = world.player(me, "Ann")
    game = world.game("A")
    world.play(me, game, at(2026, 11, 15, 23, 30), [{"player": ann}])
    world.play(me, game, at(2026, 11, 15, 1, 0), [{"player": ann}])
    world.play(me, game, at(2025, 12, 31, 23, 0), [{"player": ann}])
    world.db.commit()
    svc = service(world, me)
    utc = svc.heatmap(flt(svc, "UTC"), 2026)
    assert {d["date"]: d["plays"] for d in utc["days"]} == {"2026-11-15": 2}
    assert utc["max_plays_in_day"] == 2 and utc["active_days"] == 1
    nz = svc.heatmap(flt(svc, NZ), 2026)
    # 2025-12-31 23:00 UTC is 1 Jan 2026 in Auckland; the 23:30 play moves a day.
    assert {d["date"]: d["plays"] for d in nz["days"]} == {
        "2026-01-01": 1, "2026-11-15": 1, "2026-11-16": 1,
    }
    with pytest.raises(ValueError):
        svc.heatmap(flt(svc), 1999)


def test_weekly_streak_across_a_year_and_timezone(world):
    me = world.user()
    ann = world.player(me, "Ann")
    game = world.game("A")
    for when in (at(2026, 12, 22), at(2026, 12, 30), at(2027, 1, 6)):
        world.play(me, game, when, [{"player": ann}])
    # Sunday 15 Nov 2026 23:30 UTC is Monday 16 Nov in Auckland.
    world.play(me, game, at(2026, 11, 15, 23, 30), [{"player": ann}])
    world.db.commit()
    svc = service(world, me)
    now = at(2027, 1, 7)
    result = svc.streak(flt(svc, LON), now)
    assert result["current_weeks"] == 3 and result["best_weeks"] == 3
    assert result["played_this_week"] is True
    # A week later with no play: alive but at risk.
    later = svc.streak(flt(svc, LON), at(2027, 1, 13))
    assert later["current_weeks"] == 3 and later["at_risk"] is True
    # Two weeks later the streak is broken, best remains.
    broken = svc.streak(flt(svc, LON), at(2027, 1, 20))
    assert broken["current_weeks"] == 0 and broken["best_weeks"] == 3
    # The November play is in different ISO weeks in UTC and Auckland.
    assert svc.repository.play_week_starts(flt(svc, "UTC"))[0] == date(2026, 11, 9)
    assert svc.repository.play_week_starts(flt(svc, NZ))[0] == date(2026, 11, 16)


# ---- records ---------------------------------------------------------- #


def sheet(world, user, game, version=1):
    schema = {
        "format_version": 1,
        "categories": [
            {"id": "wonders", "label": "Wonders", "type": "number", "points_per": 1, "scope": "once"},
            {"id": "coins", "label": "Coins", "type": "count", "points_per": 3, "scope": "once"},
        ],
    }
    row = Scoresheet(
        bgg_game_id=game.bgg_id, owner_user_id=user.id, schema=schema,
        format_version=1, version=version,
    )
    world.db.add(row)
    world.db.flush()
    world.db.add(ScoresheetVersion(scoresheet_id=row.id, version=version, schema=schema, format_version=1))
    world.db.flush()
    return row


def test_records_use_competitive_coop_team_outcomes_and_breakdowns(world):
    me = world.user()
    ann, bob, cat = (world.player(me, n) for n in ("Ann", "Bob", "Cat"))
    duel = world.game("Duel")
    coop = world.game("Coop", coop=True)
    teams = world.game("Teams")
    plain = world.game("Plain")
    world.play(me, duel, at(2026, 3, 1), [
        {"player": ann, "score": 50, "rank": 1}, {"player": bob, "score": 42, "rank": 2},
    ])
    world.play(me, duel, at(2026, 3, 8), [
        {"player": ann, "score": 30, "rank": 2}, {"player": bob, "score": 61, "rank": 1},
    ])
    # Lost co-op: every score is a losing one.
    world.play(me, coop, at(2026, 3, 9), [{"player": ann, "score": 18}, {"player": bob, "score": 18}],
               outcome_type="cooperative", coop_result="lost")
    world.play(me, coop, at(2026, 3, 10), [{"player": ann, "score": 25}, {"player": bob, "score": 25}],
               outcome_type="cooperative", coop_result="won")
    world.play(me, teams, at(2026, 3, 11), [
        {"player": ann, "score": 70, "team": "Red", "rank": 1, "win": True},
        {"player": bob, "score": 70, "team": "Red", "rank": 1, "win": True},
        {"player": cat, "score": 55, "team": "Blue", "rank": 2},
    ], outcome_type="team")
    # No scores at all: no record row.
    world.play(me, plain, at(2026, 3, 12), [{"player": ann}, {"player": bob}])
    # Sheet-based play: best category is Coins (7 x 3 = 21).
    sh = sheet(world, me, duel)
    world.play(me, duel, at(2026, 3, 13), [
        {"player": ann, "score": 40, "rank": 1, "breakdown": {"wonders": 19, "coins": 7}},
        {"player": bob, "score": 20, "rank": 2, "breakdown": {"wonders": 9, "coins": 3}},
    ], scoresheet=sh, scoresheet_version=1)
    world.db.commit()
    svc = service(world, me)
    records = {r["name"].rsplit(" ", 1)[0]: r for r in svc.records(flt(svc), 50)["games"]}
    assert "Plain" not in records
    d = records["Duel"]
    assert (d["best"], d["lowest"], d["scored_plays"]) == (61, 20, 3)
    assert d["average"] == pytest.approx((50 + 42 + 30 + 61 + 40 + 20) / 6)
    assert d["highest_losing"] == 42
    assert d["best_category"] == {"label": "Coins", "points": 21}
    c = records["Coop"]
    assert (c["best"], c["lowest"]) == (25, 18)
    assert c["highest_losing"] == 18  # the lost co-op play
    t = records["Teams"]
    assert t["highest_losing"] == 55 and t["best"] == 70
    # Player filter narrows to one player's own scores.
    only_bob = svc.records(flt(svc, player_id=bob.id), 50)["games"]
    bob_duel = next(r for r in only_bob if r["name"].startswith("Duel"))
    assert (bob_duel["best"], bob_duel["lowest"], bob_duel["highest_losing"]) == (61, 20, 42)


# ---- head to head ------------------------------------------------------ #


def test_head_to_head_excludes_coop_and_separates_teams(world):
    me = world.user()
    ann, bob, cat = (world.player(me, n) for n in ("Ann", "Bob", "Cat"))
    g = world.game("G")
    coop = world.game("Coop", coop=True)
    teams = world.game("Teams")
    # Ann beats Bob, Bob beats Ann, tie for first, unscored flagged win.
    world.play(me, g, at(2026, 1, 1), [{"player": ann, "rank": 1}, {"player": bob, "rank": 2}])
    world.play(me, g, at(2026, 1, 2), [{"player": ann, "rank": 2}, {"player": bob, "rank": 1}])
    world.play(me, g, at(2026, 1, 3), [{"player": ann, "rank": 1}, {"player": bob, "rank": 1}])
    world.play(me, g, at(2026, 1, 4), [{"player": ann, "win": True}, {"player": bob}])
    world.play(me, g, at(2026, 1, 5), [{"player": ann}, {"player": bob}])  # undecided
    # Ranked below a third player: ranks still order Ann above Bob.
    world.play(me, g, at(2026, 1, 6), [
        {"player": cat, "rank": 1}, {"player": ann, "rank": 2}, {"player": bob, "rank": 3},
    ])
    # Co-op: excluded from the record, shown separately.
    world.play(me, coop, at(2026, 1, 7), [{"player": ann}, {"player": bob}],
               outcome_type="cooperative", coop_result="won")
    world.play(me, coop, at(2026, 1, 8), [{"player": ann}, {"player": bob}],
               outcome_type="cooperative", coop_result="lost")
    # Team plays: opposing teams count, shared team does not.
    world.play(me, teams, at(2026, 1, 9), [
        {"player": ann, "team": "Red", "win": True, "rank": 1},
        {"player": bob, "team": "Blue", "rank": 2},
    ], outcome_type="team")
    world.play(me, teams, at(2026, 1, 10), [
        {"player": ann, "team": "Red", "win": True, "rank": 1},
        {"player": bob, "team": "Red", "win": True, "rank": 1},
        {"player": cat, "team": "Blue", "rank": 2},
    ], outcome_type="team")
    # A play without Bob never counts.
    world.play(me, g, at(2026, 1, 11), [{"player": ann, "rank": 1}, {"player": cat, "rank": 2}])
    world.db.commit()
    svc = service(world, me)
    h2h = svc.head_to_head(ann.id, bob.id, flt(svc))
    assert h2h["plays_together"] == 10
    assert h2h["versus_plays"] == 7
    assert (h2h["wins_a"], h2h["wins_b"], h2h["draws"], h2h["undecided"]) == (4, 1, 1, 1)
    assert (h2h["coop_plays"], h2h["coop_won"], h2h["coop_lost"]) == (2, 1, 1)
    assert h2h["same_team_plays"] == 1
    assert h2h["recent"][0]["kind"] == "teammates"
    swapped = svc.head_to_head(bob.id, ann.id, flt(svc))
    assert (swapped["wins_a"], swapped["wins_b"]) == (1, 4)
    with pytest.raises(ValueError):
        svc.head_to_head(ann.id, ann.id, flt(svc))
    with pytest.raises(ValueError):
        svc.head_to_head(ann.id, 999_999_999, flt(svc))


# ---- filters and isolation --------------------------------------------- #


def test_every_filter_narrows_every_chart_and_record(world):
    me = world.user()
    ann, bob = world.player(me, "Ann"), world.player(me, "Bob")
    game = world.game("A")
    world.play(me, game, at(2026, 3, 1), [{"player": ann, "score": 10}, {"player": bob, "score": 5}],
               location="Home", player_count=2)
    world.play(me, game, at(2026, 4, 1), [{"player": ann, "score": 20}],
               location="  home ", player_count=1)
    world.play(me, game, at(2026, 5, 1), [{"player": bob, "score": 30}, {"player": ann, "score": 1}, {"player": bob, "score": 2}],
               location="Cafe", player_count=3)
    world.db.commit()
    svc = service(world, me)
    now = at(2026, 6, 1)

    def total(**kw):
        return svc.plays_per_month(flt(svc, **kw), 12, now)["total_plays"]

    assert total() == 3
    assert total(date_from=date(2026, 4, 1)) == 2
    assert total(date_to=date(2026, 3, 31)) == 1
    assert total(date_from=date(2026, 4, 1), date_to=date(2026, 4, 30)) == 1
    assert total(player_id=bob.id) == 2
    assert total(location="HOME") == 2
    assert total(location="cafe") == 1
    assert total(player_count=2) == 1
    assert total(player_id=ann.id, location="home", player_count=1) == 1
    assert svc.heatmap(flt(svc, location="Cafe"), 2026)["total_plays"] == 1
    assert svc.h_index(flt(svc, player_count=3))["total_plays"] == 1
    assert svc.records(flt(svc, location="Cafe"), 10)["games"][0]["best"] == 30
    options = svc.filter_options("UTC")
    assert {o["name"].lower(): o["plays"] for o in options["locations"]} == {"home": 2, "cafe": 1}
    assert options["player_counts"] == [1, 2, 3]
    assert (options["first_play"], options["last_play"]) == (date(2026, 3, 1), date(2026, 5, 1))
    with pytest.raises(ValueError):
        flt(svc, date_from=date(2026, 5, 1), date_to=date(2026, 4, 1))
    with pytest.raises(ValueError):
        flt(svc, "Not/AZone")


def test_filters_reject_other_accounts_players(world):
    me, other = world.user(), world.user()
    stranger = world.player(other, "Stranger")
    world.db.commit()
    svc = service(world, me)
    with pytest.raises(ValueError):
        flt(svc, player_id=stranger.id)


def test_account_isolation_on_every_aggregate(world):
    me, other = world.user(), world.user()
    mine, theirs = world.player(me, "Me"), world.player(other, "Them")
    game = world.game("A")
    world.play(other, game, at(2026, 4, 1), [{"player": theirs, "score": 99}], location="Home")
    world.db.commit()
    svc = service(world, me)
    assert svc.plays_per_month(flt(svc), 12, at(2026, 6, 1))["total_plays"] == 0
    assert svc.heatmap(flt(svc), 2026)["total_plays"] == 0
    assert svc.h_index(flt(svc))["games_played"] == 0
    assert svc.records(flt(svc), 10)["games"] == []
    assert svc.streak(flt(svc), at(2026, 6, 1))["best_weeks"] == 0
    assert svc.filter_options("UTC")["locations"] == []


# ---- entitlements over HTTP --------------------------------------------- #


@pytest.fixture
def client(world):
    def override_db():
        yield world.db

    state = {"user": None}
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: state["user"]
    with TestClient(app) as test_client:
        test_client.state = state
        yield test_client
    app.dependency_overrides.clear()


def test_free_account_gets_free_stats_and_is_refused_pro_stats(world, client):
    free, pro = world.user("FREE"), world.user("PRO")
    ann = world.player(free, "Ann")
    game = world.game("A")
    world.play(free, game, at(2026, 4, 1), [{"player": ann, "score": 5}])
    world.db.commit()
    params = {"timezone": "UTC"}

    client.state["user"] = free
    for path in ("plays-per-month", "heatmap", "h-index", "streak"):
        assert client.get(f"/stats/{path}", params=params).status_code == 200, path
    for path, extra in (
        ("records", {}),
        ("head-to-head", {"player_a": ann.id, "player_b": ann.id + 1}),
        ("filter-options", {}),
    ):
        response = client.get(f"/stats/{path}", params={**params, **extra})
        assert response.status_code == 403, path
        assert "Pro" in response.json()["detail"]
    for extra in ({"location": "Home"}, {"player_count": 2}, {"date_from": "2026-01-01"}, {"player_id": ann.id}):
        assert client.get("/stats/plays-per-month", params={**params, **extra}).status_code == 403
    assert client.get("/stats/plays-per-month", params={**params, "months": 5}).status_code == 422
    assert client.get("/stats/streak", params={"timezone": "Nope/Zone"}).status_code == 422

    client.state["user"] = pro
    assert client.get("/stats/records", params=params).status_code == 200
    assert client.get("/stats/filter-options", params=params).status_code == 200
    ok = client.get("/stats/plays-per-month", params={**params, "location": "Home"})
    assert ok.status_code == 200 and ok.json()["total_plays"] == 0
    bad = client.get("/stats/head-to-head", params={**params, "player_a": 1, "player_b": 1})
    assert bad.status_code == 422


def test_help_h_index_is_refused_for_free_on_the_server(world, client):
    free, pro = world.user("FREE"), world.user("PRO")
    world.db.commit()
    client.state["user"] = free
    refused = client.get("/picker", params={"players": 2, "help_h_index": "true"})
    assert refused.status_code == 403
    assert "Pro" in refused.json()["detail"]
    assert client.get("/picker", params={"players": 2}).status_code == 200
    client.state["user"] = pro
    assert client.get("/picker", params={"players": 2, "help_h_index": "true"}).status_code == 200


def test_picker_boost_end_to_end_for_pro(world, client):
    from database.models import UserGame

    pro = world.user("PRO")
    ann = world.player(pro, "Ann")
    games = [world.game(name) for name in ("Alpha", "Zulu", "Big1", "Big2")]
    for game in games:
        game.owned = True
        game.min_players, game.max_players = 2, 4
        game.min_play_time = game.max_play_time = 40
        world.db.add(UserGame(user_id=pro.id, game_id=game.id))
    # Big1/Big2: 4 plays each => h = 2; Zulu has 2 plays (1 away from 3),
    # Alpha 1 play (2 away).
    for game, count in zip(games, (1, 2, 4, 4)):
        for n in range(count):
            world.play(pro, game, at(2026, 1, 1 + n), [{"player": ann}])
    world.db.commit()
    client.state["user"] = pro
    plain = client.get("/picker", params={"players": 3, "limit": 50}).json()
    boosted = client.get("/picker", params={"players": 3, "limit": 50, "help_h_index": "true"}).json()
    again = client.get("/picker", params={"players": 3, "limit": 50, "help_h_index": "true"}).json()

    def rows(payload):
        return [
            {"name": r["game"]["name"], "score": r["score"], "reasons": r["reasons"]}
            for r in payload
            if r["game"]["name"].endswith(world.tag)
        ]

    plain_rows, boost_rows, again_rows = rows(plain), rows(boosted), rows(again)
    assert [r["name"] for r in boost_rows] == [r["name"] for r in again_rows]
    zulu = next(r for r in boost_rows if r["name"].startswith("Zulu"))
    zulu_plain = next(r for r in plain_rows if r["name"].startswith("Zulu"))
    assert zulu["score"] > zulu_plain["score"]
    assert any("H-index" in reason for reason in zulu["reasons"])
    assert not any("H-index" in reason for r in plain_rows for reason in r["reasons"])


# ---- 10,000 plays ------------------------------------------------------ #


def test_ten_thousand_plays_answer_each_endpoint_under_500_ms(world):
    me = world.user()
    players = [world.player(me, f"P{n}") for n in range(8)]
    games = [world.game(f"G{n}") for n in range(120)]
    sh = sheet(world, me, games[0])
    world.db.commit()

    plays, parts = [], []
    start = at(2024, 1, 1)
    base_id = world.db.query(Play.id).order_by(Play.id.desc()).limit(1).scalar() or 0
    for n in range(10_000):
        game = games[(n * 7) % 120 if n % 3 else n % 15]
        outcome = "cooperative" if n % 11 == 0 else "competitive"
        plays.append(dict(
            id=base_id + n + 1, user_id=me.id, game_id=game.id,
            played_at=start + timedelta(hours=n * 2), player_count=3,
            location=("Home", "Cafe", "Club")[n % 3], outcome_type=outcome,
            coop_result="won" if outcome == "cooperative" else None, source="app",
            scoresheet_id=sh.id if game is games[0] else None,
            scoresheet_version=1 if game is games[0] else None,
        ))
        for k in range(3):
            parts.append(dict(
                play_id=base_id + n + 1, name=f"P{k}",
                player_id=players[(n + k) % 8].id,
                score=float((n * 13 + k * 7) % 90), is_winner=outcome == "cooperative" or k == 0,
                rank=None if outcome == "cooperative" else k + 1,
                score_breakdown={"wonders": 10 + k, "coins": k} if game is games[0] else None,
            ))
    world.db.bulk_insert_mappings(Play, plays)
    world.db.bulk_insert_mappings(PlayParticipant, parts)
    world.db.commit()
    world.db.execute(__import__("sqlalchemy").text("ANALYZE plays"))
    world.db.execute(__import__("sqlalchemy").text("ANALYZE play_participants"))

    svc = service(world, me)
    now = at(2026, 6, 1)
    calls = {
        "plays-per-month": lambda: svc.plays_per_month(flt(svc, LON), 24, now),
        "heatmap": lambda: svc.heatmap(flt(svc, LON), 2025, now),
        "h-index": lambda: svc.h_index(flt(svc, LON)),
        "streak": lambda: svc.streak(flt(svc, LON), now),
        "records": lambda: svc.records(flt(svc, LON), 100),
        "head-to-head": lambda: svc.head_to_head(players[0].id, players[1].id, flt(svc, LON)),
        "filtered-records": lambda: svc.records(
            flt(svc, LON, date_from=date(2025, 1, 1), player_id=players[2].id, location="Cafe", player_count=3), 100),
        "filter-options": lambda: svc.filter_options(LON),
        "picker-boosts": lambda: svc.picker_h_index_boosts(flt(svc, "UTC")),
    }
    for name, call in calls.items():
        call()  # warm the plan cache
        started = perf_counter()
        result = call()
        elapsed = (perf_counter() - started) * 1000
        print(f"stats-perf {name}: {elapsed:.0f} ms")
        assert elapsed < 500, f"{name} took {elapsed:.0f} ms"
        assert result is not None
    assert svc.records(flt(svc), 100)["games"]
    assert svc.head_to_head(players[0].id, players[1].id, flt(svc))["plays_together"] > 0
