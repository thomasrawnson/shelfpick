from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from database.models import (
    Game,
    GameComparison,
    GameRanking,
    Play,
    UserGame,
)


class RankingRepository:
    def __init__(
        self,
        db: Session,
        user_id: int,
    ):
        self.db = db
        self.user_id = user_id

    @staticmethod
    def _game_payload(
        game: Game,
        ranking: GameRanking | None = None,
    ) -> dict:
        return {
            "bgg_id": game.bgg_id,
            "name": game.name,
            "year_published": game.year_published,
            "image_url": game.image_url,
            "thumbnail_url": game.thumbnail_url,
            "rating": (
                round(ranking.rating)
                if ranking is not None
                else 1500
            ),
            "comparisons_count": (
                ranking.comparisons_count
                if ranking is not None
                else 0
            ),
            "wins": (
                ranking.wins
                if ranking is not None
                else 0
            ),
            "losses": (
                ranking.losses
                if ranking is not None
                else 0
            ),
        }

    def get_matchup(
        self,
        exclude_bgg_ids: list[int] | None = None,
        played_only: bool = True,
    ) -> list[dict]:
        query = (
            self.db.query(Game, GameRanking)
            .join(
                UserGame,
                and_(
                    UserGame.game_id == Game.id,
                    UserGame.user_id
                    == self.user_id,
                ),
            )
            .outerjoin(
                GameRanking,
                and_(
                    GameRanking.game_id == Game.id,
                    GameRanking.user_id
                    == self.user_id,
                ),
            )
            .filter(
                Game.is_expansion.is_(False),
                or_(
                    GameRanking.id.is_(None),
                    GameRanking.excluded.is_(False),
                ),
            )
        )

        if played_only:
            has_recorded_play = (
                self.db.query(Play.id)
                .filter(
                    Play.user_id == self.user_id,
                    Play.game_id == Game.id,
                )
                .exists()
            )
            query = query.filter(has_recorded_play)

        if exclude_bgg_ids:
            query = query.filter(
                Game.bgg_id.notin_(
                    exclude_bgg_ids
                )
            )

        rows = (
            query.order_by(
                func.coalesce(
                    GameRanking.comparisons_count,
                    0,
                ),
                func.random(),
            )
            .limit(2)
            .all()
        )

        return [
            self._game_payload(game, ranking)
            for game, ranking in rows
        ]

    def get_compared_owned_games(self) -> list[dict]:
        """Return current compared games for personal recommendation signals."""
        rows = (
            self.db.query(Game, GameRanking)
            .join(
                GameRanking,
                and_(
                    GameRanking.game_id == Game.id,
                    GameRanking.user_id == self.user_id,
                ),
            )
            .join(
                UserGame,
                and_(
                    UserGame.game_id == Game.id,
                    UserGame.user_id == self.user_id,
                ),
            )
            .filter(
                Game.is_expansion.is_(False),
                GameRanking.excluded.is_(False),
                GameRanking.comparisons_count > 0,
            )
            .order_by(GameRanking.rating.desc(), Game.name)
            .all()
        )

        return [
            {
                "bgg_id": game.bgg_id,
                "rating": ranking.rating,
                "comparisons_count": ranking.comparisons_count,
                "categories": [category.name for category in game.categories],
                "mechanics": [mechanic.name for mechanic in game.mechanics],
            }
            for game, ranking in rows
        ]

    @staticmethod
    def _top_values(
        games: list[Game],
        attribute: str,
        limit: int = 5,
    ) -> list[dict]:
        counts: dict[str, int] = {}
        best_positions: dict[str, int] = {}

        for position, game in enumerate(games, start=1):
            for raw_value in getattr(game, attribute, []) or []:
                raw_name = getattr(
                    raw_value,
                    "name",
                    raw_value,
                )
                name = raw_name.strip()
                if not name:
                    continue
                counts[name] = counts.get(name, 0) + 1
                best_positions.setdefault(name, position)

        ordered = sorted(
            counts,
            key=lambda name: (
                -counts[name],
                best_positions[name],
                name.casefold(),
            ),
        )

        return [
            {"name": name, "count": counts[name]}
            for name in ordered[:limit]
        ]

    def get_rankings(
        self,
        played_only: bool = True,
        summary_limit: int = 20,
    ) -> dict:
        rows = (
            self.db.query(Game, GameRanking)
            .join(
                GameRanking,
                and_(
                    GameRanking.game_id == Game.id,
                    GameRanking.user_id
                    == self.user_id,
                ),
            )
            .join(
                UserGame,
                and_(
                    UserGame.game_id == Game.id,
                    UserGame.user_id
                    == self.user_id,
                ),
            )
            .filter(
                Game.is_expansion.is_(False)
            )
            .order_by(
                GameRanking.excluded,
                GameRanking.rating.desc(),
                Game.name,
            )
            .all()
        )

        ranked = []
        ranked_games = []
        unplayed = []

        played_game_ids = {
            game_id
            for (game_id,) in (
                self.db.query(Play.game_id)
                .filter(Play.user_id == self.user_id)
                .distinct()
                .all()
            )
        }

        for game, ranking in rows:
            payload = self._game_payload(
                game,
                ranking,
            )

            if ranking.excluded:
                unplayed.append(payload)
            elif (
                ranking.comparisons_count > 0
                and (
                    not played_only
                    or game.id in played_game_ids
                )
            ):
                payload["rank"] = len(ranked) + 1
                ranked.append(payload)
                ranked_games.append(game)

        top_games = ranked_games[:summary_limit]

        return {
            "rankings": ranked,
            "unplayed": unplayed,
            "summary": {
                "games_count": len(top_games),
                "designers": self._top_values(
                    top_games,
                    "designers",
                ),
                "publishers": self._top_values(
                    top_games,
                    "publishers",
                ),
                "mechanics": self._top_values(
                    top_games,
                    "mechanics",
                ),
                "categories": self._top_values(
                    top_games,
                    "categories",
                ),
            },
        }

    def record_comparison(
        self,
        winner_bgg_id: int,
        loser_bgg_id: int,
    ) -> dict | None:
        games = (
            self.db.query(Game)
            .join(
                UserGame,
                and_(
                    UserGame.game_id == Game.id,
                    UserGame.user_id
                    == self.user_id,
                ),
            )
            .filter(
                Game.bgg_id.in_([
                    winner_bgg_id,
                    loser_bgg_id,
                ]),
                Game.is_expansion.is_(False),
            )
            .all()
        )

        games_by_bgg_id = {
            game.bgg_id: game
            for game in games
        }

        if len(games_by_bgg_id) != 2:
            return None

        rankings = (
            self.db.query(GameRanking)
            .filter(
                GameRanking.user_id
                == self.user_id,
                GameRanking.game_id.in_([
                    game.id
                    for game in games
                ]),
            )
            .with_for_update()
            .all()
        )

        rankings_by_game_id = {
            ranking.game_id: ranking
            for ranking in rankings
        }

        def get_ranking(game: Game) -> GameRanking:
            ranking = rankings_by_game_id.get(
                game.id
            )

            if ranking is None:
                ranking = GameRanking(
                    user_id=self.user_id,
                    game_id=game.id,
                    rating=1500.0,
                    comparisons_count=0,
                    wins=0,
                    losses=0,
                    excluded=False,
                )
                self.db.add(ranking)
                rankings_by_game_id[
                    game.id
                ] = ranking

            return ranking

        winner_game = games_by_bgg_id[
            winner_bgg_id
        ]
        loser_game = games_by_bgg_id[
            loser_bgg_id
        ]
        winner = get_ranking(winner_game)
        loser = get_ranking(loser_game)

        if winner.excluded or loser.excluded:
            return None

        expected_winner = 1 / (
            1
            + 10
            ** (
                (loser.rating - winner.rating)
                / 400
            )
        )
        rating_change = 24 * (
            1 - expected_winner
        )

        winner.rating += rating_change
        loser.rating -= rating_change
        winner.comparisons_count += 1
        loser.comparisons_count += 1
        winner.wins += 1
        loser.losses += 1

        self.db.add(
            GameComparison(
                user_id=self.user_id,
                winner_game_id=winner_game.id,
                loser_game_id=loser_game.id,
            )
        )
        self.db.commit()

        return {
            "winner": self._game_payload(
                winner_game,
                winner,
            ),
            "loser": self._game_payload(
                loser_game,
                loser,
            ),
        }

    def set_unplayed(
        self,
        bgg_id: int,
        excluded: bool,
    ) -> bool:
        game = (
            self.db.query(Game)
            .join(
                UserGame,
                and_(
                    UserGame.game_id == Game.id,
                    UserGame.user_id
                    == self.user_id,
                ),
            )
            .filter(
                Game.bgg_id == bgg_id,
                Game.is_expansion.is_(False),
            )
            .first()
        )

        if game is None:
            return False

        ranking = (
            self.db.query(GameRanking)
            .filter(
                GameRanking.user_id
                == self.user_id,
                GameRanking.game_id == game.id,
            )
            .first()
        )

        if ranking is None:
            ranking = GameRanking(
                user_id=self.user_id,
                game_id=game.id,
                rating=1500.0,
                comparisons_count=0,
                wins=0,
                losses=0,
            )
            self.db.add(ranking)

        ranking.excluded = excluded
        self.db.commit()

        return True
