"""SQL aggregates behind the Stats tab (SP-STATS-01).

Every query is scoped to one account and runs in the database: counts per
month and day, per-game play totals, distinct play weeks, score records and
head-to-head results. Months, days and weeks use the caller's IANA timezone.
Outcomes mirror ``services.play_results.resolve_outcome`` in SQL so a record
or a head-to-head never disagrees with the play history.
"""

from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy import (
    Date,
    and_,
    case,
    cast,
    exists,
    func,
    select,
)
from sqlalchemy.orm import Session, aliased

from database.models import (
    Game,
    Mechanic,
    Play,
    PlayParticipant,
    Player,
    Scoresheet,
    ScoresheetVersion,
    UserGame,
    game_mechanics,
)


@dataclass(frozen=True)
class StatsFilters:
    """Optional narrowing shared by every stats query.

    ``start``/``end`` are UTC instants, ``end`` exclusive.
    """

    timezone: str
    start: datetime | None = None
    end: datetime | None = None
    player_id: int | None = None
    location: str | None = None
    player_count: int | None = None

    @property
    def narrowed(self) -> bool:
        return any(
            value is not None
            for value in (
                self.start,
                self.end,
                self.player_id,
                self.location,
                self.player_count,
            )
        )


def _normalized_location(value):
    return func.lower(func.btrim(value))


class StatsRepository:
    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    # ------------------------------------------------------------------ #
    # shared pieces
    # ------------------------------------------------------------------ #

    def _play_conditions(
        self,
        filters: StatsFilters,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> list:
        """WHERE clauses on ``Play`` for the account and the filters.

        ``start``/``end`` add a window; they intersect the filter's own range.
        """
        conditions = [Play.user_id == self.user_id]
        for lower in (filters.start, start):
            if lower is not None:
                conditions.append(Play.played_at >= lower)
        for upper in (filters.end, end):
            if upper is not None:
                conditions.append(Play.played_at < upper)
        if filters.player_count is not None:
            conditions.append(Play.player_count == filters.player_count)
        if filters.location is not None:
            conditions.append(
                _normalized_location(Play.location)
                == _normalized_location(filters.location)
            )
        if filters.player_id is not None:
            member = aliased(PlayParticipant)
            conditions.append(
                exists().where(
                    member.play_id == Play.id,
                    member.player_id == filters.player_id,
                )
            )
        return conditions

    @staticmethod
    def _local(timezone_name: str):
        return func.timezone(timezone_name, Play.played_at)

    def player_exists(self, player_id: int) -> bool:
        return (
            self.db.query(Player.id)
            .filter(Player.id == player_id, Player.user_id == self.user_id)
            .first()
            is not None
        )

    # ------------------------------------------------------------------ #
    # Free: months, heatmap, H-index counts, weeks
    # ------------------------------------------------------------------ #

    def plays_by_month(
        self,
        filters: StatsFilters,
        start: datetime,
        end: datetime,
    ) -> dict[str, int]:
        """Plays per local month, keyed ``YYYY-MM``; months without plays absent."""
        month = func.date_trunc("month", self._local(filters.timezone))
        rows = (
            self.db.query(month.label("month"), func.count(Play.id))
            .filter(*self._play_conditions(filters, start, end))
            .group_by(month)
            .all()
        )
        return {row[0].strftime("%Y-%m"): row[1] for row in rows}

    def plays_by_day(
        self,
        filters: StatsFilters,
        start: datetime,
        end: datetime,
    ) -> dict[date, int]:
        day = cast(self._local(filters.timezone), type_=Date)
        rows = (
            self.db.query(day.label("day"), func.count(Play.id))
            .filter(*self._play_conditions(filters, start, end))
            .group_by(day)
            .all()
        )
        return {row[0]: row[1] for row in rows}

    def game_play_counts(self, filters: StatsFilters) -> list[dict]:
        """Plays per game, most played first; ties by name then BGG id."""
        count = func.count(Play.id)
        rows = (
            self.db.query(Game.bgg_id, Game.name, count.label("plays"))
            .join(Game, Game.id == Play.game_id)
            .filter(*self._play_conditions(filters))
            .group_by(Game.id, Game.bgg_id, Game.name)
            .order_by(count.desc(), Game.name, Game.bgg_id)
            .all()
        )
        return [
            {"bgg_id": row.bgg_id, "name": row.name, "plays": row.plays}
            for row in rows
        ]

    def unplayed_owned_games(self, filters: StatsFilters) -> list[dict]:
        """Owned non-expansions with no play in the filtered history."""
        played = (
            select(Play.game_id)
            .where(*self._play_conditions(filters))
            .distinct()
        )
        rows = (
            self.db.query(Game.bgg_id, Game.name)
            .join(UserGame, UserGame.game_id == Game.id)
            .filter(
                UserGame.user_id == self.user_id,
                Game.is_expansion.is_(False),
                Game.id.not_in(played),
            )
            .order_by(Game.name, Game.bgg_id)
            .all()
        )
        return [
            {"bgg_id": row.bgg_id, "name": row.name, "plays": 0}
            for row in rows
        ]

    def play_week_starts(self, filters: StatsFilters) -> list[date]:
        """Distinct local ISO weeks (Monday dates) with a play, ascending."""
        week = cast(
            func.date_trunc("week", self._local(filters.timezone)),
            type_=Date,
        )
        rows = (
            self.db.query(week)
            .filter(*self._play_conditions(filters))
            .distinct()
            .order_by(week)
            .all()
        )
        return [row[0] for row in rows]

    # ------------------------------------------------------------------ #
    # outcomes in SQL
    # ------------------------------------------------------------------ #

    def _participant_outcomes(self, filters: StatsFilters, extra=()):
        """Subquery with one row per participant of a filtered play.

        Columns: play_id, game_id, played_at, outcome_type, coop_result,
        player_id, team, rank, score, outcome (win/loss/draw/unknown).
        Mirrors ``resolve_outcome``.
        """
        over = {"partition_by": PlayParticipant.play_id}
        n_total = func.count(PlayParticipant.id).over(**over)
        n_winners = (
            func.count(PlayParticipant.id)
            .filter(PlayParticipant.is_winner.is_(True))
            .over(**over)
        )
        n_ranked = func.count(PlayParticipant.rank).over(**over)
        n_top = (
            func.count(PlayParticipant.id)
            .filter(PlayParticipant.rank == 1)
            .over(**over)
        )
        winner_team_min = (
            func.min(PlayParticipant.team)
            .filter(PlayParticipant.is_winner.is_(True))
            .over(**over)
        )
        winner_team_max = (
            func.max(PlayParticipant.team)
            .filter(PlayParticipant.is_winner.is_(True))
            .over(**over)
        )
        winners_scored = (
            func.count(PlayParticipant.score)
            .filter(PlayParticipant.is_winner.is_(True))
            .over(**over)
        )
        winner_score_min = (
            func.min(PlayParticipant.score)
            .filter(PlayParticipant.is_winner.is_(True))
            .over(**over)
        )
        winner_score_max = (
            func.max(PlayParticipant.score)
            .filter(PlayParticipant.is_winner.is_(True))
            .over(**over)
        )
        coop_game = Play.game_id.in_(
            select(game_mechanics.c.game_id)
            .join(Mechanic, Mechanic.id == game_mechanics.c.mechanic_id)
            .where(func.lower(func.btrim(Mechanic.name)) == "cooperative game")
        )

        flagged_tie = and_(
            n_winners > 1,
            winners_scored == n_winners,
            winner_score_min == winner_score_max,
        )
        outcome = case(
            (
                Play.outcome_type.in_(("cooperative", "solo")),
                case(
                    (Play.coop_result == "won", "win"),
                    (Play.coop_result == "lost", "loss"),
                    else_="unknown",
                ),
            ),
            (
                Play.outcome_type == "team",
                case(
                    (n_winners == 0, "unknown"),
                    (PlayParticipant.is_winner.is_(False), "loss"),
                    (winner_team_min != winner_team_max, "draw"),
                    else_="win",
                ),
            ),
            (
                n_ranked > 0,
                case(
                    (PlayParticipant.rank.is_(None), "unknown"),
                    (n_top == 0, "unknown"),
                    (PlayParticipant.rank != 1, "loss"),
                    (n_top > 1, "draw"),
                    else_="win",
                ),
            ),
            else_=case(
                (n_winners == 0, "unknown"),
                (PlayParticipant.is_winner.is_(False), "loss"),
                (and_(coop_game, n_winners == n_total), "win"),
                (flagged_tie, "draw"),
                else_="win",
            ),
        )
        return (
            select(
                Play.id.label("play_id"),
                Play.game_id.label("game_id"),
                Play.played_at.label("played_at"),
                Play.outcome_type.label("outcome_type"),
                Play.coop_result.label("coop_result"),
                Play.scoresheet_id.label("scoresheet_id"),
                Play.scoresheet_version.label("scoresheet_version"),
                PlayParticipant.id.label("participant_id"),
                PlayParticipant.player_id.label("player_id"),
                PlayParticipant.team.label("team"),
                PlayParticipant.rank.label("rank"),
                PlayParticipant.score.label("score"),
                PlayParticipant.score_breakdown.label("score_breakdown"),
                outcome.label("outcome"),
            )
            .select_from(Play)
            .join(PlayParticipant, PlayParticipant.play_id == Play.id)
            .where(*self._play_conditions(filters), *extra)
            .subquery()
        )

    # ------------------------------------------------------------------ #
    # Pro: records
    # ------------------------------------------------------------------ #

    def score_records(self, filters: StatsFilters, limit: int) -> list[dict]:
        """Per-game score records over participant totals.

        With a player filter only that player's scores count; otherwise every
        recorded score at the table does.
        """
        po = self._participant_outcomes(filters)
        scoped = [po.c.score.is_not(None)]
        if filters.player_id is not None:
            scoped.append(po.c.player_id == filters.player_id)

        rows = (
            self.db.query(
                Game.bgg_id,
                Game.name,
                func.count(func.distinct(po.c.play_id)).label("scored_plays"),
                func.max(po.c.score).label("best"),
                func.avg(po.c.score).label("average"),
                func.min(po.c.score).label("lowest"),
                func.max(po.c.score)
                .filter(po.c.outcome == "loss")
                .label("highest_losing"),
            )
            .select_from(po)
            .join(Game, Game.id == po.c.game_id)
            .filter(*scoped)
            .group_by(Game.id, Game.bgg_id, Game.name)
            .order_by(
                func.count(func.distinct(po.c.play_id)).desc(),
                Game.name,
                Game.bgg_id,
            )
            .limit(limit)
            .all()
        )
        records = [
            {
                "bgg_id": row.bgg_id,
                "name": row.name,
                "scored_plays": row.scored_plays,
                "best": row.best,
                "average": float(row.average),
                "lowest": row.lowest,
                "highest_losing": row.highest_losing,
                "best_category": None,
            }
            for row in rows
        ]
        if records:
            best = self._best_categories(
                po, scoped, {record["bgg_id"] for record in records}
            )
            for record in records:
                record["best_category"] = best.get(record["bgg_id"])
        return records

    def _best_categories(self, po, scoped, bgg_ids: set[int]) -> dict:
        """Highest single category entry per game, from scoresheet breakdowns.

        Points are the category's raw total times its ``points_per``, using the
        exact sheet version each play was logged on. Ties go to the label that
        sorts first.
        """
        rows = (
            self.db.query(
                Game.bgg_id,
                po.c.scoresheet_id,
                po.c.scoresheet_version,
                po.c.score_breakdown,
            )
            .select_from(po)
            .join(Game, Game.id == po.c.game_id)
            .filter(
                *scoped,
                po.c.score_breakdown.is_not(None),
                po.c.scoresheet_id.is_not(None),
                Game.bgg_id.in_(bgg_ids),
            )
            .all()
        )
        if not rows:
            return {}

        sheets = self._sheet_schemas(
            {(row.scoresheet_id, row.scoresheet_version) for row in rows}
        )
        best: dict[int, dict] = {}
        for row in rows:
            schema = sheets.get((row.scoresheet_id, row.scoresheet_version))
            if schema is None or not isinstance(row.score_breakdown, dict):
                continue
            for category in schema.get("categories", []):
                points_per = category.get("points_per", 0)
                if not points_per:
                    continue
                value = row.score_breakdown.get(category["id"])
                if value is None:
                    continue
                if isinstance(value, list):
                    raw = sum(value)
                elif category.get("type") == "boolean":
                    raw = 1 if value else 0
                else:
                    raw = value
                points = raw * points_per
                label = category.get("label") or category["id"]
                current = best.get(row.bgg_id)
                if (
                    current is None
                    or points > current["points"]
                    or (points == current["points"] and label < current["label"])
                ):
                    best[row.bgg_id] = {"label": label, "points": points}
        return best

    def _sheet_schemas(self, keys: set[tuple[int, int | None]]) -> dict:
        sheet_ids = {key[0] for key in keys}
        schemas = {}
        versions = (
            self.db.query(
                ScoresheetVersion.scoresheet_id,
                ScoresheetVersion.version,
                ScoresheetVersion.schema,
            )
            .filter(ScoresheetVersion.scoresheet_id.in_(sheet_ids))
            .all()
        )
        for row in versions:
            schemas[(row.scoresheet_id, row.version)] = row.schema
        current = (
            self.db.query(Scoresheet.id, Scoresheet.version, Scoresheet.schema)
            .filter(Scoresheet.id.in_(sheet_ids))
            .all()
        )
        for row in current:
            schemas.setdefault((row.id, row.version), row.schema)
        return schemas

    # ------------------------------------------------------------------ #
    # Pro: head to head
    # ------------------------------------------------------------------ #

    def head_to_head(
        self,
        player_a: int,
        player_b: int,
        filters: StatsFilters,
        recent_limit: int = 5,
    ) -> dict:
        """Results for plays both players took part in.

        Co-op and solo plays are counted separately (won / lost together),
        as are team plays where they shared a team. Everything else is a
        versus play: ranks decide when both have one, otherwise the recorded
        winner flags do, and no recorded result is "undecided".
        """
        def took_part(player_id):
            member = aliased(PlayParticipant)
            return Play.id.in_(
                select(member.play_id).where(member.player_id == player_id)
            )

        po = self._participant_outcomes(
            filters, (took_part(player_a), took_part(player_b))
        )
        a = po.alias("a")
        b = po.alias("b")

        top = ("win", "draw")
        kind = case(
            (a.c.outcome_type.in_(("cooperative", "solo")), "coop"),
            (
                and_(a.c.outcome_type == "team", a.c.team == b.c.team),
                "teammates",
            ),
            else_="versus",
        )
        result = case(
            (
                and_(a.c.rank.is_not(None), b.c.rank.is_not(None)),
                case(
                    (a.c.rank < b.c.rank, "a"),
                    (a.c.rank > b.c.rank, "b"),
                    else_="draw",
                ),
            ),
            (and_(a.c.outcome.in_(top), b.c.outcome == "loss"), "a"),
            (and_(b.c.outcome.in_(top), a.c.outcome == "loss"), "b"),
            (and_(a.c.outcome.in_(top), b.c.outcome.in_(top)), "draw"),
            else_="undecided",
        )
        rows = (
            self.db.query(
                a.c.play_id,
                a.c.played_at,
                a.c.coop_result,
                Game.bgg_id,
                Game.name,
                kind.label("kind"),
                result.label("result"),
            )
            .select_from(a)
            .join(
                b,
                and_(
                    b.c.play_id == a.c.play_id,
                    b.c.participant_id != a.c.participant_id,
                ),
            )
            .join(Game, Game.id == a.c.game_id)
            .filter(a.c.player_id == player_a, b.c.player_id == player_b)
            .order_by(a.c.played_at.desc(), a.c.play_id.desc())
            .all()
        )

        summary = {
            "plays_together": len(rows),
            "versus_plays": 0,
            "wins_a": 0,
            "wins_b": 0,
            "draws": 0,
            "undecided": 0,
            "coop_plays": 0,
            "coop_won": 0,
            "coop_lost": 0,
            "same_team_plays": 0,
        }
        for row in rows:
            if row.kind == "coop":
                summary["coop_plays"] += 1
                if row.coop_result == "won":
                    summary["coop_won"] += 1
                elif row.coop_result == "lost":
                    summary["coop_lost"] += 1
            elif row.kind == "teammates":
                summary["same_team_plays"] += 1
            else:
                summary["versus_plays"] += 1
                if row.result == "a":
                    summary["wins_a"] += 1
                elif row.result == "b":
                    summary["wins_b"] += 1
                elif row.result == "draw":
                    summary["draws"] += 1
                else:
                    summary["undecided"] += 1

        summary["recent"] = [
            {
                "play_id": row.play_id,
                "played_at": row.played_at,
                "bgg_id": row.bgg_id,
                "game": row.name,
                "kind": row.kind,
                "result": row.result if row.kind == "versus" else None,
                "coop_result": row.coop_result if row.kind == "coop" else None,
            }
            for row in rows[:recent_limit]
        ]
        return summary

    # ------------------------------------------------------------------ #
    # Pro: filter options
    # ------------------------------------------------------------------ #

    def filter_options(self, timezone_name: str) -> dict:
        locations = (
            self.db.query(
                _normalized_location(Play.location).label("key"),
                func.max(Play.location).label("label"),
                func.count(Play.id).label("plays"),
            )
            .filter(
                Play.user_id == self.user_id,
                Play.location.is_not(None),
                func.btrim(Play.location) != "",
            )
            .group_by(_normalized_location(Play.location))
            .order_by(func.count(Play.id).desc(), "key")
            .limit(100)
            .all()
        )
        counts = (
            self.db.query(Play.player_count)
            .filter(Play.user_id == self.user_id, Play.player_count > 0)
            .distinct()
            .order_by(Play.player_count)
            .all()
        )
        local = self._local(timezone_name)
        bounds = (
            self.db.query(
                cast(func.min(local), type_=Date),
                cast(func.max(local), type_=Date),
            )
            .filter(Play.user_id == self.user_id)
            .one()
        )
        return {
            "locations": [
                {"name": row.label.strip(), "plays": row.plays}
                for row in locations
            ],
            "player_counts": [row[0] for row in counts],
            "first_play": bounds[0],
            "last_play": bounds[1],
        }

