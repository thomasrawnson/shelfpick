"""Stats tab rules: H-index, streaks, charts and Pro filters (SP-STATS-01)."""

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from repositories.stats_repository import StatsFilters, StatsRepository

RAISE_LIST_LIMIT = 10
MAX_RECORDS = 100

# Picker boost for games that would count toward a higher H-index. Bounded:
# at most this many points, on the 0 to 100 Picker score.
H_INDEX_BOOST_ONE_PLAY = 6
H_INDEX_BOOST_TWO_PLAYS = 3


def compute_h_index(game_plays: list[dict], unplayed: list[dict] | None = None) -> dict:
    """H-index of a play history.

    ``game_plays`` is one ``{"bgg_id", "name", "plays"}`` per played game, most
    played first. H is the largest ``h`` with ``h`` games played at least ``h``
    times. ``raise_list`` holds the games to play to reach ``h + 1``: the
    ``h + 1 - k`` cheapest games (``k`` already have ``h + 1`` plays), each with
    the plays it still needs. ``unplayed`` games (0 plays) can be candidates.
    """
    ordered = sorted(
        game_plays,
        key=lambda game: (-game["plays"], game["name"], game["bgg_id"]),
    )
    h_index = 0
    for position, game in enumerate(ordered, start=1):
        if game["plays"] >= position:
            h_index = position
        else:
            break

    target = h_index + 1
    already = sum(1 for game in ordered if game["plays"] >= target)
    needed_games = target - already

    candidates = [
        {**game, "plays_needed": target - game["plays"]}
        for game in [*ordered, *(unplayed or [])]
        if game["plays"] < target
    ]
    candidates.sort(
        key=lambda game: (
            game["plays_needed"],
            -game["plays"],
            game["name"],
            game["bgg_id"],
        )
    )
    chosen = candidates[:needed_games]
    return {
        "h_index": h_index,
        "next_target": target,
        "games_played": len(ordered),
        "total_plays": sum(game["plays"] for game in ordered),
        "qualifying_games": [
            game for game in ordered[:h_index]
        ],
        "games_needed": needed_games,
        "reachable": len(chosen) == needed_games,
        "plays_needed_total": sum(game["plays_needed"] for game in chosen),
        "raise_list": [
            {
                "bgg_id": game["bgg_id"],
                "name": game["name"],
                "plays": game["plays"],
                "plays_needed": game["plays_needed"],
            }
            for game in chosen[:RAISE_LIST_LIMIT]
        ],
        "_candidates": candidates,
    }


def h_index_boosts(h_result: dict) -> dict[int, dict]:
    """Picker boost per BGG id: games one or two plays from counting."""
    boosts = {}
    for game in h_result["_candidates"]:
        needed = game["plays_needed"]
        if needed == 1:
            points = H_INDEX_BOOST_ONE_PLAY
        elif needed == 2:
            points = H_INDEX_BOOST_TWO_PLAYS
        else:
            continue
        boosts[game["bgg_id"]] = {
            "points": points,
            "reason": (
                f"Helps your H-index: {needed} more "
                f"{'play' if needed == 1 else 'plays'} and this game "
                f"counts toward an H-index of {h_result['next_target']}"
            ),
        }
    return boosts


def compute_streaks(weeks: list[date], this_week: date) -> dict:
    """Weekly play streaks from distinct ISO week-start dates (Mondays).

    The current streak ends this week, or last week while this week has no
    play yet (the streak is then ``at_risk`` but not broken).
    """
    ordered = sorted(set(weeks))
    best = 0
    run = 0
    previous = None
    runs_end: dict[date, int] = {}
    for week in ordered:
        run = run + 1 if previous is not None and week - previous == timedelta(days=7) else 1
        runs_end[week] = run
        best = max(best, run)
        previous = week

    played_this_week = this_week in runs_end
    last_week = this_week - timedelta(days=7)
    if played_this_week:
        current = runs_end[this_week]
    elif last_week in runs_end:
        current = runs_end[last_week]
    else:
        current = 0
    return {
        "current_weeks": current,
        "best_weeks": best,
        "played_this_week": played_this_week,
        "at_risk": current > 0 and not played_this_week,
        "this_week_start": this_week,
    }


class StatsService:
    def __init__(self, repository: StatsRepository):
        self.repository = repository

    # -------------------------------------------------------------- #
    # input handling
    # -------------------------------------------------------------- #

    @staticmethod
    def parse_timezone(timezone_name: str) -> ZoneInfo:
        try:
            return ZoneInfo(timezone_name)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Timezone must be a valid IANA timezone.") from None

    @classmethod
    def local_midnight_utc(cls, day: date, zone: ZoneInfo) -> datetime:
        return datetime(day.year, day.month, day.day, tzinfo=zone).astimezone(
            timezone.utc
        )

    def build_filters(
        self,
        timezone_name: str,
        date_from: date | None = None,
        date_to: date | None = None,
        player_id: int | None = None,
        location: str | None = None,
        player_count: int | None = None,
    ) -> StatsFilters:
        zone = self.parse_timezone(timezone_name)
        if date_from and date_to and date_from > date_to:
            raise ValueError("Start date must not be after the end date.")
        if player_id is not None and not self.repository.player_exists(player_id):
            raise ValueError("Unknown player.")
        cleaned = " ".join(location.split()) if location else None
        return StatsFilters(
            timezone=timezone_name,
            start=self.local_midnight_utc(date_from, zone) if date_from else None,
            end=(
                self.local_midnight_utc(date_to + timedelta(days=1), zone)
                if date_to
                else None
            ),
            player_id=player_id,
            location=cleaned or None,
            player_count=player_count,
        )

    @staticmethod
    def _now_local(zone: ZoneInfo, now: datetime | None) -> datetime:
        return (now or datetime.now(timezone.utc)).astimezone(zone)

    # -------------------------------------------------------------- #
    # Free
    # -------------------------------------------------------------- #

    def plays_per_month(
        self,
        filters: StatsFilters,
        months: int,
        now: datetime | None = None,
    ) -> dict:
        if months not in (12, 24):
            raise ValueError("Months must be 12 or 24.")
        zone = self.parse_timezone(filters.timezone)
        today = self._now_local(zone, now)
        index = today.year * 12 + today.month - 1
        keys = [
            f"{(i // 12):04d}-{(i % 12) + 1:02d}"
            for i in range(index - months + 1, index + 1)
        ]
        first_year, first_month = map(int, keys[0].split("-"))
        start = self.local_midnight_utc(date(first_year, first_month, 1), zone)
        counts = self.repository.plays_by_month(filters, start, None)
        return {
            "months": [{"month": key, "plays": counts.get(key, 0)} for key in keys],
            "total_plays": sum(counts.get(key, 0) for key in keys),
        }

    def heatmap(
        self,
        filters: StatsFilters,
        year: int | None,
        now: datetime | None = None,
    ) -> dict:
        zone = self.parse_timezone(filters.timezone)
        if year is None:
            year = self._now_local(zone, now).year
        if not 2000 <= year <= 2100:
            raise ValueError("Year must be between 2000 and 2100.")
        start = self.local_midnight_utc(date(year, 1, 1), zone)
        end = self.local_midnight_utc(date(year + 1, 1, 1), zone)
        counts = self.repository.plays_by_day(filters, start, end)
        days = [
            {"date": day.isoformat(), "plays": plays}
            for day, plays in sorted(counts.items())
        ]
        return {
            "year": year,
            "days": days,
            "total_plays": sum(counts.values()),
            "active_days": len(counts),
            "max_plays_in_day": max(counts.values(), default=0),
        }

    def h_index(self, filters: StatsFilters) -> dict:
        result = self._h_index_result(filters)
        return {key: value for key, value in result.items() if key != "_candidates"}

    def _h_index_result(self, filters: StatsFilters) -> dict:
        return compute_h_index(
            self.repository.game_play_counts(filters),
            self.repository.unplayed_owned_games(filters),
        )

    def picker_h_index_boosts(self, filters: StatsFilters) -> dict[int, dict]:
        return h_index_boosts(self._h_index_result(filters))

    def streak(self, filters: StatsFilters, now: datetime | None = None) -> dict:
        zone = self.parse_timezone(filters.timezone)
        today = self._now_local(zone, now).date()
        this_week = today - timedelta(days=today.weekday())
        weeks = self.repository.play_week_starts(filters)
        streaks = compute_streaks(weeks, this_week)
        streaks["this_week_start"] = this_week.isoformat()
        return streaks

    # -------------------------------------------------------------- #
    # Pro
    # -------------------------------------------------------------- #

    def records(self, filters: StatsFilters, limit: int) -> dict:
        limit = max(1, min(limit, MAX_RECORDS))
        return {"games": self.repository.score_records(filters, limit)}

    def head_to_head(
        self,
        player_a: int,
        player_b: int,
        filters: StatsFilters,
    ) -> dict:
        if player_a == player_b:
            raise ValueError("Choose two different players.")
        for player_id in (player_a, player_b):
            if not self.repository.player_exists(player_id):
                raise ValueError("Unknown player.")
        return {
            "player_a": player_a,
            "player_b": player_b,
            **self.repository.head_to_head(player_a, player_b, filters),
        }

    def filter_options(self, timezone_name: str) -> dict:
        self.parse_timezone(timezone_name)
        return self.repository.filter_options(timezone_name)
