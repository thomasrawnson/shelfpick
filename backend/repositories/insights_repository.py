from sqlalchemy import case, func
from sqlalchemy.dialects.postgresql import (
    aggregate_order_by,
)
from sqlalchemy.orm import Session

from database.models import (
    Game,
    Play,
    PlayParticipant,
    Player,
    UserGame,
)
from models.collection_insights import (
    GamePlaySummary,
    LastPlayedGame,
    MonthlyActivity,
    MonthlyPlay,
    MonthlyRecapGame,
    NeglectedGame,
    PlayerGroupSummary,
    PlayerSummary,
    PlayerTopGame,
)
from datetime import (
    datetime,
    timezone,
)
class InsightsRepository:
    def __init__(
        self,
        db: Session,
        user_id: int | None = None,
    ):
        self.db = db
        self.user_id = user_id

    def total_owned_games(self) -> int:
        if self.user_id is None:
            return 0

        return (
            self.db.query(
                func.count(UserGame.game_id)
            )
            .join(
                Game,
                Game.id
                == UserGame.game_id,
            )
            .filter(
                UserGame.user_id
                == self.user_id,
                Game.is_expansion
                .is_(False),
            )
            .scalar()
            or 0
        )

    def total_plays(self) -> int:
        if self.user_id is None:
            return 0

        return (
            self.db.query(
                func.count(Play.id)
            )
            .filter(
                Play.user_id
                == self.user_id
            )
            .scalar()
            or 0
        )

    def played_games_count(self) -> int:
        if self.user_id is None:
            return 0

        return (
            self.db.query(
                func.count(
                    func.distinct(
                        Play.game_id
                    )
                )
            )
            .join(
                UserGame,
                UserGame.game_id
                == Play.game_id,
            )
            .join(
                Game,
                Game.id
                == Play.game_id,
            )
            .filter(
                Play.user_id
                == self.user_id,
                UserGame.user_id
                == self.user_id,
                Game.is_expansion
                .is_(False),
            )
            .scalar()
            or 0
        )

    def historical_played_games_count(
        self,
    ) -> int:
        if self.user_id is None:
            return 0

        return (
            self.db.query(
                func.count(
                    func.distinct(
                        Play.game_id
                    )
                )
            )
            .filter(
                Play.user_id
                == self.user_id
            )
            .scalar()
            or 0
        )

    def total_duration_minutes(
        self,
    ) -> int | None:
        if self.user_id is None:
            return None

        return (
            self.db.query(
                func.sum(
                    Play.duration_minutes
                )
            )
            .filter(
                Play.user_id
                == self.user_id
            )
            .scalar()
        )

    def duration_plays(self) -> int:
        if self.user_id is None:
            return 0

        return (
            self.db.query(
                func.count(
                    Play.duration_minutes
                )
            )
            .filter(
                Play.user_id
                == self.user_id
            )
            .scalar()
            or 0
        )

    def average_duration_minutes(
        self,
    ) -> int | None:
        if self.user_id is None:
            return None

        result = (
            self.db.query(
                func.avg(
                    Play.duration_minutes
                )
            )
            .filter(
                Play.user_id
                == self.user_id,
                Play.duration_minutes
                .is_not(None),
            )
            .scalar()
        )

        if result is None:
            return None

        return round(float(result))

    def get_most_played(
        self,
    ) -> GamePlaySummary | None:
        if self.user_id is None:
            return None

        result = (
            self.db.query(
                Game.bgg_id,
                Game.name,
                func.count(
                    Play.id
                ).label("play_count"),
            )
            .join(
                Play,
                Play.game_id == Game.id,
            )
            .filter(
                Play.user_id
                == self.user_id,
            )
            .group_by(
                Game.id,
                Game.bgg_id,
                Game.name,
            )
            .order_by(
                func.count(
                    Play.id
                ).desc(),
                func.lower(
                    Game.name
                ).asc(),
                Game.bgg_id.asc(),
            )
            .first()
        )

        if result is None:
            return None

        return GamePlaySummary(
            bgg_id=result.bgg_id,
            name=result.name,
            play_count=result.play_count,
        )

    def get_last_played(
        self,
    ) -> LastPlayedGame | None:
        if self.user_id is None:
            return None

        result = (
            self.db.query(
                Game.bgg_id,
                Game.name,
                Play.played_at,
            )
            .join(
                Play,
                Play.game_id == Game.id,
            )
            .filter(
                Play.user_id
                == self.user_id,
            )
            .order_by(
                Play.played_at.desc(),
                Play.id.desc(),
            )
            .first()
        )

        if result is None:
            return None

        return LastPlayedGame(
            bgg_id=result.bgg_id,
            name=result.name,
            played_at=result.played_at,
        )

    def never_played_count(self) -> int:
        if self.user_id is None:
            return 0

        played_game_ids = (
            self.db.query(
                Play.game_id
            )
            .filter(
                Play.user_id
                == self.user_id
            )
        )

        return (
            self.db.query(
                func.count(
                    UserGame.game_id
                )
            )
            .join(
                Game,
                Game.id
                == UserGame.game_id,
            )
            .filter(
                UserGame.user_id
                == self.user_id,
                Game.is_expansion
                .is_(False),
                ~UserGame.game_id.in_(
                    played_game_ids
                ),
            )
            .scalar()
            or 0
        )

    def get_frequent_players(
        self,
        limit: int = 5,
    ) -> list[PlayerSummary]:
        if self.user_id is None:
            return []

        rows = (
            self.db.query(
                Player.id,
                Player.name,
                func.count(
                    PlayParticipant.id
                ).label(
                    "play_count"
                ),
                func.sum(
                    case(
                        (
                            PlayParticipant
                            .is_winner
                            .is_(True),
                            1,
                        ),
                        else_=0,
                    )
                ).label(
                    "win_count"
                ),
            )
            .join(
                PlayParticipant,
                PlayParticipant.player_id
                == Player.id,
            )
            .join(
                Play,
                Play.id
                == PlayParticipant.play_id,
            )
            .filter(
                Player.user_id
                == self.user_id,
                Play.user_id
                == self.user_id,
            )
            .group_by(
                Player.id,
                Player.name,
            )
            .order_by(
                func.count(
                    PlayParticipant.id
                ).desc(),
                Player.name,
            )
            .limit(limit)
            .all()
        )

        return [
            PlayerSummary(
                id=row.id,
                name=row.name,
                play_count=row.play_count,
                win_count=(
                    row.win_count or 0
                ),
            )
            for row in rows
        ]

    def get_monthly_activity(
        self,
    ) -> MonthlyActivity:
        if self.user_id is None:
            return MonthlyActivity(
                plays=0,
                unique_games=0,
                new_games=0,
                repeat_plays=0,
                recent_plays=[],
            )

        now = datetime.now(
            timezone.utc
        )

        month_start = datetime(
            now.year,
            now.month,
            1,
            tzinfo=timezone.utc,
        )

        plays_this_month = (
            self.db.query(
                func.count(
                    Play.id
                )
            )
            .filter(
                Play.user_id
                == self.user_id,
                Play.played_at
                >= month_start,
            )
            .scalar()
            or 0
        )

        unique_games = (
            self.db.query(
                func.count(
                    func.distinct(
                        Play.game_id
                    )
                )
            )
            .filter(
                Play.user_id
                == self.user_id,
                Play.played_at
                >= month_start,
            )
            .scalar()
            or 0
        )

        first_play_dates = (
            self.db.query(
                Play.game_id.label(
                    "game_id"
                ),
                func.min(
                    Play.played_at
                ).label(
                    "first_played_at"
                ),
            )
            .filter(
                Play.user_id
                == self.user_id
            )
            .group_by(
                Play.game_id
            )
            .subquery()
        )

        new_games = (
            self.db.query(
                func.count()
            )
            .select_from(
                first_play_dates
            )
            .filter(
                first_play_dates
                .c
                .first_played_at
                >= month_start
            )
            .scalar()
            or 0
        )

        repeat_plays = (
            self.db.query(
                func.count(
                    Play.id
                )
            )
            .join(
                first_play_dates,
                first_play_dates
                .c
                .game_id
                == Play.game_id,
            )
            .filter(
                Play.user_id
                == self.user_id,
                Play.played_at
                >= month_start,
                first_play_dates
                .c
                .first_played_at
                < month_start,
            )
            .scalar()
            or 0
        )

        recent_rows = (
            self.db.query(
                Play.id,
                Game.bgg_id,
                Game.name,
                Play.played_at,
                Play.player_count,
            )
            .join(
                Game,
                Game.id == Play.game_id,
            )
            .filter(
                Play.user_id
                == self.user_id,
                Play.played_at
                >= month_start,
            )
            .order_by(
                Play.played_at.desc()
            )
            .limit(20)
            .all()
        )

        recent_plays = [
            MonthlyPlay(
                play_id=row.id,
                bgg_id=row.bgg_id,
                game_name=row.name,
                played_at=row.played_at,
                player_count=row.player_count,
            )
            for row in recent_rows
        ]
        return MonthlyActivity(
            plays=plays_this_month,
            unique_games=unique_games,
            new_games=new_games,
            repeat_plays=repeat_plays,
            recent_plays=recent_plays,
        )

    def get_monthly_recap(
        self,
        start: datetime,
        end: datetime,
        limit: int = 4,
    ) -> dict:
        if self.user_id is None:
            return {
                "total_plays": 0,
                "unique_games": 0,
                "total_duration_minutes": None,
                "duration_plays": 0,
                "games": [],
            }

        scoped_plays = (
            self.db.query(Play)
            .filter(
                Play.user_id == self.user_id,
                Play.played_at >= start,
                Play.played_at < end,
            )
        )
        totals = scoped_plays.with_entities(
            func.count(Play.id).label("total_plays"),
            func.count(func.distinct(Play.game_id)).label("unique_games"),
            func.sum(Play.duration_minutes).label("total_duration_minutes"),
            func.count(Play.duration_minutes).label("duration_plays"),
        ).one()

        rows = (
            self.db.query(
                Game.bgg_id,
                Game.name,
                Game.image_url,
                func.count(Play.id).label("play_count"),
                func.max(Play.played_at).label("last_played_at"),
            )
            .join(Play, Play.game_id == Game.id)
            .filter(
                Play.user_id == self.user_id,
                Play.played_at >= start,
                Play.played_at < end,
            )
            .group_by(Game.id, Game.bgg_id, Game.name, Game.image_url)
            .order_by(
                func.count(Play.id).desc(),
                func.max(Play.played_at).desc(),
                func.lower(Game.name).asc(),
                Game.bgg_id.asc(),
            )
            .limit(limit)
            .all()
        )

        return {
            "total_plays": totals.total_plays or 0,
            "unique_games": totals.unique_games or 0,
            "total_duration_minutes": totals.total_duration_minutes,
            "duration_plays": totals.duration_plays or 0,
            "games": [
                MonthlyRecapGame(
                    bgg_id=row.bgg_id,
                    name=row.name,
                    play_count=row.play_count,
                    image_url=row.image_url,
                )
                for row in rows
            ],
        }


    def get_neglected_games(
        self,
        limit: int = 5,
    ) -> list[NeglectedGame]:
        if self.user_id is None:
            return []

        rows = (
            self.db.query(
                Game.bgg_id,
                Game.name,
                func.count(
                    Play.id
                ).label(
                    "play_count"
                ),
                func.max(
                    Play.played_at
                ).label(
                    "last_played_at"
                ),
            )
            .join(
                UserGame,
                UserGame.game_id
                == Game.id,
            )
            .outerjoin(
                Play,
                (
                    Play.game_id
                    == Game.id
                )
                & (
                    Play.user_id
                    == self.user_id
                ),
            )
            .filter(
                UserGame.user_id
                == self.user_id,
                Game.is_expansion
                .is_(False),
            )
            .group_by(
                Game.id,
                Game.bgg_id,
                Game.name,
            )
            .order_by(
                case(
                    (
                        func.count(
                            Play.id
                        )
                        == 0,
                        0,
                    ),
                    else_=1,
                ),
                func.max(
                    Play.played_at
                ).asc(),
                func.count(
                    Play.id
                ).asc(),
                Game.name,
            )
            .limit(limit)
            .all()
        )

        return [
            NeglectedGame(
                bgg_id=row.bgg_id,
                name=row.name,
                play_count=(
                    row.play_count or 0
                ),
                last_played_at=(
                    row.last_played_at
                ),
            )
            for row in rows
        ]


    def get_top_games_by_player(
        self,
        limit: int = 5,
    ) -> list[PlayerTopGame]:
        if self.user_id is None:
            return []

        ranked_rows = (
            self.db.query(
                Player.id.label(
                    "player_id"
                ),
                Player.name.label(
                    "player_name"
                ),
                Game.bgg_id.label(
                    "bgg_id"
                ),
                Game.name.label(
                    "game_name"
                ),
                func.count(
                    Play.id
                ).label(
                    "play_count"
                ),
                func.row_number().over(
                    partition_by=Player.id,
                    order_by=(
                        func.count(
                            Play.id
                        ).desc()
                    ),
                ).label(
                    "row_number"
                ),
            )
            .join(
                PlayParticipant,
                PlayParticipant.player_id
                == Player.id,
            )
            .join(
                Play,
                Play.id
                == PlayParticipant.play_id,
            )
            .join(
                Game,
                Game.id
                == Play.game_id,
            )
            .filter(
                Player.user_id
                == self.user_id,
                Play.user_id
                == self.user_id,
            )
            .group_by(
                Player.id,
                Player.name,
                Game.id,
                Game.bgg_id,
                Game.name,
            )
            .subquery()
        )

        rows = (
            self.db.query(
                ranked_rows
            )
            .filter(
                ranked_rows
                .c
                .row_number
                == 1
            )
            .order_by(
                ranked_rows
                .c
                .play_count
                .desc(),
                ranked_rows
                .c
                .player_name,
            )
            .limit(limit)
            .all()
        )

        return [
            PlayerTopGame(
                player_id=(
                    row.player_id
                ),
                player_name=(
                    row.player_name
                ),
                bgg_id=(
                    row.bgg_id
                ),
                game_name=(
                    row.game_name
                ),
                play_count=(
                    row.play_count
                ),
            )
            for row in rows
        ]


    def get_common_groups(
        self,
        limit: int = 5,
    ) -> list[PlayerGroupSummary]:
        if self.user_id is None:
            return []

        distinct_members = (
            self.db.query(
                Play.id.label("play_id"),
                Player.id.label("player_id"),
                Player.name.label("player_name"),
            )
            .join(
                PlayParticipant,
                PlayParticipant.play_id
                == Play.id,
            )
            .join(
                Player,
                Player.id
                == PlayParticipant.player_id,
            )
            .filter(
                Play.user_id
                == self.user_id,
                Player.user_id
                == self.user_id,
            )
            .distinct(
                Play.id,
                Player.id,
                Player.name,
            )
            .subquery()
        )

        play_groups = (
            self.db.query(
                distinct_members.c.play_id,
                func.array_agg(
                    aggregate_order_by(
                        distinct_members.c.player_id,
                        distinct_members.c.player_id,
                    )
                ).label("player_ids"),
                func.array_agg(
                    aggregate_order_by(
                        distinct_members.c.player_name,
                        distinct_members.c.player_id,
                    )
                ).label("player_names"),
            )
            .group_by(
                distinct_members.c.play_id,
            )
            .having(
                func.count() >= 2
            )
            .subquery()
        )

        play_count = func.count().label(
            "play_count"
        )

        rows = (
            self.db.query(
                play_groups.c.player_ids,
                play_groups.c.player_names,
                play_count,
            )
            .group_by(
                play_groups.c.player_ids,
                play_groups.c.player_names,
            )
            .order_by(
                play_count.desc(),
                play_groups.c.player_names.asc(),
                play_groups.c.player_ids.asc(),
            )
            .limit(limit)
            .all()
        )

        return [
            PlayerGroupSummary(
                player_ids=(
                    row.player_ids
                ),
                player_names=(
                    row.player_names
                ),
                play_count=(
                    row.play_count
                ),
            )
            for row in rows
        ]
