from collections import Counter
from statistics import median

from sqlalchemy import func

from database.models import (
    Game as DatabaseGame,
)
from database.models import (
    Play as DatabasePlay,
)
from database.models import (
    PlayParticipant,
    Player,
    User,
    UserGame,
)
from models.game_play_stats import GamePlayStats


class PlayReadRepository:
    def get_discover_profile(self) -> dict[str, int | str | None]:
        if self.user_id is None:
            return {
                "typical_player_count": None,
                "typical_play_time": None,
                "player_count_source": None,
                "play_time_source": None,
            }

        user = self.db.get(User, self.user_id)

        rows = (
            self.db.query(
                DatabasePlay.player_count,
                DatabasePlay.duration_minutes,
            )
            .filter(DatabasePlay.user_id == self.user_id)
            .all()
        )

        player_counts = Counter(
            row.player_count
            for row in rows
            if row.player_count > 0
        )
        durations = [
            row.duration_minutes
            for row in rows
            if row.duration_minutes is not None
            and row.duration_minutes > 0
        ]

        typical_player_count = None
        if player_counts:
            typical_player_count = min(
                player_counts,
                key=lambda count: (-player_counts[count], count),
            )

        return {
            "typical_player_count": (
                user.preferred_player_count if user and user.preferred_player_count is not None
                else typical_player_count
            ),
            "typical_play_time": (
                user.preferred_play_time if user and user.preferred_play_time is not None
                else (round(median(durations)) if durations else None)
            ),
            "player_count_source": (
                "preference"
                if user and user.preferred_player_count is not None
                else ("history" if typical_player_count is not None else None)
            ),
            "play_time_source": (
                "preference"
                if user and user.preferred_play_time is not None
                else ("history" if durations else None)
            ),
        }

    def get_game_play_stats(
        self,
    ) -> dict[int, GamePlayStats]:
        if self.user_id is None:
            return {}

        rows = (
            self.db.query(
                DatabaseGame.bgg_id,
                func.count(
                    DatabasePlay.id
                ).label("play_count"),
                func.max(
                    DatabasePlay.played_at
                ).label("last_played_at"),
            )
            .join(
                UserGame,
                UserGame.game_id
                == DatabaseGame.id,
            )
            .outerjoin(
                DatabasePlay,
                (
                    DatabasePlay.game_id
                    == DatabaseGame.id
                )
                & (
                    DatabasePlay.user_id
                    == self.user_id
                ),
            )
            .filter(
                UserGame.user_id
                == self.user_id
            )
            .group_by(
                DatabaseGame.id,
                DatabaseGame.bgg_id,
            )
            .all()
        )

        return {
            row.bgg_id: GamePlayStats(
                bgg_id=row.bgg_id,
                play_count=row.play_count,
                last_played_at=(
                    row.last_played_at
                ),
            )
            for row in rows
        }

    def get_for_game(
        self,
        bgg_id: int,
        limit: int = 10,
    ):
        if self.user_id is None:
            return []

        rows = (
            self.db.query(
                DatabasePlay,
                DatabaseGame.bgg_id,
            )
            .join(
                DatabaseGame,
                DatabaseGame.id
                == DatabasePlay.game_id,
            )
            .join(
                UserGame,
                UserGame.game_id
                == DatabaseGame.id,
            )
            .filter(
                DatabasePlay.user_id
                == self.user_id,
                UserGame.user_id
                == self.user_id,
                DatabaseGame.bgg_id
                == bgg_id,
            )
            .order_by(
                DatabasePlay.played_at.desc()
            )
            .limit(limit)
            .all()
        )

        return [
            {
                "id": play.id,
                "bgg_id": game_bgg_id,
                "player_count": (
                    play.player_count
                ),
                "played_at": (
                    play.played_at
                ),
                "duration_minutes": (
                    play.duration_minutes
                ),
                "source": play.source,
            }
            for play, game_bgg_id in rows
        ]

    def get_game_history(
        self,
        bgg_id: int,
        limit: int = 10,
    ):
        if self.user_id is None:
            return None

        database_game = (
            self.db.query(DatabaseGame)
            .join(
                UserGame,
                UserGame.game_id
                == DatabaseGame.id,
            )
            .filter(
                DatabaseGame.bgg_id
                == bgg_id,
                UserGame.user_id
                == self.user_id,
            )
            .first()
        )

        if database_game is None:
            return None

        plays = (
            self.db.query(DatabasePlay)
            .filter(
                DatabasePlay.user_id
                == self.user_id,
                DatabasePlay.game_id
                == database_game.id,
            )
            .order_by(
                DatabasePlay.played_at.desc()
            )
            .limit(limit)
            .all()
        )

        summary = (
            self.db.query(
                func.count(
                    DatabasePlay.id
                ).label("play_count"),
                func.max(
                    DatabasePlay.played_at
                ).label("last_played_at"),
                func.avg(
                    DatabasePlay.player_count
                ).label("average_players"),
                func.avg(
                    DatabasePlay.duration_minutes
                ).label("average_duration"),
            )
            .filter(
                DatabasePlay.user_id
                == self.user_id,
                DatabasePlay.game_id
                == database_game.id,
            )
            .one()
        )

        return {
            "bgg_id": bgg_id,
            "play_count": (
                summary.play_count or 0
            ),
            "last_played_at": (
                summary.last_played_at
            ),
            "average_players": (
                float(summary.average_players)
                if summary.average_players
                is not None
                else None
            ),
            "average_duration_minutes": (
                round(
                    float(
                        summary.average_duration
                    )
                )
                if summary.average_duration
                is not None
                else None
            ),
            "recent_plays": [
                {
                    "id": play.id,
                    "played_at": play.played_at,
                    "player_count": (
                        play.player_count
                    ),
                    "duration_minutes": (
                        play.duration_minutes
                    ),
                    "location": play.location,
                    "source": play.source,
                    "participants": [
                        {
                            "id": participant.id,
                            "name": (
                                participant.name
                            ),
                            "score": (
                                participant.score
                            ),
                            "is_winner": (
                                participant.is_winner
                            ),
                        }
                        for participant
                        in play.participants
                    ],
                }
                for play in plays
            ],
        }

    def get_collection_stats(
        self,
    ):
        if self.user_id is None:
            return []

        rows = (
            self.db.query(
                DatabaseGame.bgg_id,
                func.count(
                    DatabasePlay.id
                ).label(
                    "play_count"
                ),
                func.max(
                    DatabasePlay.played_at
                ).label(
                    "last_played_at"
                ),
            )
            .join(
                UserGame,
                UserGame.game_id
                == DatabaseGame.id,
            )
            .outerjoin(
                DatabasePlay,
                (
                    DatabasePlay.game_id
                    == DatabaseGame.id
                )
                & (
                    DatabasePlay.user_id
                    == self.user_id
                ),
            )
            .filter(
                UserGame.user_id
                == self.user_id
            )
            .group_by(
                DatabaseGame.id,
                DatabaseGame.bgg_id,
            )
            .all()
        )

        return [
            {
                "bgg_id": row.bgg_id,
                "play_count": (
                    row.play_count or 0
                ),
                "last_played_at": (
                    row.last_played_at
                ),
            }
            for row in rows
        ]
    def get_group_game_play_stats(
        self,
        player_ids: list[int],
    ) -> dict[int, GamePlayStats]:
        if (
            self.user_id is None
            or not player_ids
        ):
            return {}

        unique_player_ids = list(
            dict.fromkeys(
                player_ids
            )
        )

        participant_count = (
            self.db.query(
                func.count(PlayParticipant.id)
            )
            .filter(
                PlayParticipant.play_id == DatabasePlay.id
            )
            .correlate(DatabasePlay)
            .scalar_subquery()
        )

        rows = (
            self.db.query(
                DatabaseGame.bgg_id,
                func.count(
                    func.distinct(
                        DatabasePlay.id
                    )
                ).label(
                    "play_count"
                ),
                func.max(
                    DatabasePlay.played_at
                ).label(
                    "last_played_at"
                ),
            )
            .join(
                DatabasePlay,
                DatabasePlay.game_id
                == DatabaseGame.id,
            )
            .join(
                PlayParticipant,
                PlayParticipant.play_id
                == DatabasePlay.id,
            )
            .filter(
                DatabasePlay.user_id
                == self.user_id,
                participant_count
                == len(unique_player_ids),
                PlayParticipant.player_id.in_(
                    unique_player_ids
                ),
            )
            .group_by(
                DatabaseGame.id,
                DatabaseGame.bgg_id,
                DatabasePlay.id,
            )
            .having(
                func.count(
                    func.distinct(
                        PlayParticipant.player_id
                    )
                )
                == len(
                    unique_player_ids
                )
            )
            .subquery()
        )

        grouped = (
            self.db.query(
                rows.c.bgg_id,
                func.count().label(
                    "play_count"
                ),
                func.max(
                    rows.c.last_played_at
                ).label(
                    "last_played_at"
                ),
            )
            .group_by(
                rows.c.bgg_id
            )
            .all()
        )

        return {
            row.bgg_id: GamePlayStats(
                bgg_id=row.bgg_id,
                play_count=row.play_count,
                last_played_at=(
                    row.last_played_at
                ),
            )
            for row in grouped
        }
    
    def get_players(
        self,
    ) -> list[dict]:
        if self.user_id is None:
            return []

        rows = (
            self.db.query(Player)
            .filter(
                Player.user_id
                == self.user_id
            )
            .order_by(
                Player.name
            )
            .all()
        )

        return [
            {
                "id": player.id,
                "name": player.name,
                "avatar_key": player.avatar_key,
            }
            for player in rows
        ]

    def get_player_stats(
        self,
        player_id: int,
    ):
        if self.user_id is None:
            return None

        player = (
            self.db.query(Player)
            .filter(
                Player.id == player_id,
                Player.user_id == self.user_id,
            )
            .first()
        )

        if player is None:
            return None

        participant_rows = (
            self.db.query(
                PlayParticipant,
                DatabasePlay,
                DatabaseGame,
            )
            .join(
                DatabasePlay,
                DatabasePlay.id
                == PlayParticipant.play_id,
            )
            .join(
                DatabaseGame,
                DatabaseGame.id
                == DatabasePlay.game_id,
            )
            .filter(
                DatabasePlay.user_id
                == self.user_id,
                PlayParticipant.player_id
                == player_id,
            )
            .order_by(
                DatabasePlay.played_at.desc()
            )
            .all()
        )

        total_plays = len(
            participant_rows
        )

        unique_game_ids = {
            game.id
            for _participant,
            _play,
            game
            in participant_rows
        }

        wins = sum(
            1
            for participant,
            _play,
            _game
            in participant_rows
            if participant.is_winner
        )

        win_rate = (
            round(
                wins
                / total_plays
                * 100,
                1,
            )
            if total_plays
            else 0.0
        )

        game_counts: dict[
            int,
            dict,
        ] = {}

        for (
            _participant,
            play,
            game,
        ) in participant_rows:
            if game.id not in game_counts:
                game_counts[
                    game.id
                ] = {
                    "bgg_id":
                        game.bgg_id,
                    "name":
                        game.name,
                    "play_count":
                        0,
                    "last_played_at":
                        None,
                }

            game_counts[
                game.id
            ]["play_count"] += 1

            current_last_played_at = (
                game_counts[
                    game.id
                ][
                    "last_played_at"
                ]
            )

            if (
                current_last_played_at
                is None
                or play.played_at
                > current_last_played_at
            ):
                game_counts[
                    game.id
                ][
                    "last_played_at"
                ] = play.played_at

        most_played_games = sorted(
            game_counts.values(),
            key=lambda item: (
                -item[
                    "play_count"
                ],
                item[
                    "name"
                ],
            ),
        )[:5]

        recent_games = [
            {
                "play_id":
                    play.id,
                "bgg_id":
                    game.bgg_id,
                "name":
                    game.name,
                "played_at":
                    play.played_at,
                "is_winner":
                    participant.is_winner,
                "score":
                    participant.score,
            }
            for (
                participant,
                play,
                game,
            ) in participant_rows[:10]
        ]

        partner_rows = (
            self.db.query(
                Player.id,
                Player.name,
                func.count(
                    func.distinct(
                        DatabasePlay.id
                    )
                ).label(
                    "play_count"
                ),
            )
            .join(
                PlayParticipant,
                PlayParticipant.player_id
                == Player.id,
            )
            .join(
                DatabasePlay,
                DatabasePlay.id
                == PlayParticipant.play_id,
            )
            .filter(
                DatabasePlay.user_id
                == self.user_id,
                Player.user_id
                == self.user_id,
                Player.id
                != player_id,
                DatabasePlay.id.in_(
                    self.db.query(
                        PlayParticipant.play_id
                    )
                    .filter(
                        PlayParticipant.player_id
                        == player_id
                    )
                ),
            )
            .group_by(
                Player.id,
                Player.name,
            )
            .order_by(
                func.count(
                    func.distinct(
                        DatabasePlay.id
                    )
                ).desc(),
                Player.name,
            )
            .limit(5)
            .all()
        )

        common_partners = [
            {
                "id":
                    row.id,
                "name":
                    row.name,
                "play_count":
                    row.play_count,
            }
            for row
            in partner_rows
        ]

        return {
            "player": {
                "id":
                    player.id,
                "name":
                    player.name,
            },
            "total_plays":
                total_plays,
            "unique_games":
                len(
                    unique_game_ids
                ),
            "wins":
                wins,
            "win_rate":
                win_rate,
            "most_played_games":
                most_played_games,
            "recent_games":
                recent_games,
            "common_partners":
                common_partners,
        }
