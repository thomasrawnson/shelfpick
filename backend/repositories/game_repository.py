from sqlalchemy.orm import Session

from database.models import Category
from database.models import Game as DatabaseGame
from database.models import Mechanic
from models.game import Game as DomainGame
from models.game import PlayerCountPoll
from database.models import UserGame
from database.models import UserWishlistGame


class GameRepository:
    def __init__(self, db: Session):
        self.db = db
        self.autocommit = True

    def _finish_write(self) -> None:
        if self.autocommit:
            self.db.commit()
        else:
            self.db.flush()

    def get_owned_by_user(
        self,
        user_id: int,
    ) -> list[DomainGame]:
        database_games = (
            self.db.query(DatabaseGame)
            .join(
                UserGame,
                UserGame.game_id
                == DatabaseGame.id,
            )
            .filter(
                UserGame.user_id == user_id,
                DatabaseGame.is_expansion
                .is_(False),
            )
            .order_by(DatabaseGame.name)
            .all()
        )

        games = [
            self._to_domain(game)
            for game in database_games
        ]

        for game in games:
            game.owned = True

        return games


    def get_owned_by_bgg_id(
        self,
        user_id: int,
        bgg_id: int,
    ) -> DomainGame | None:
        database_game = (
            self.db.query(DatabaseGame)
            .join(
                UserGame,
                UserGame.game_id
                == DatabaseGame.id,
            )
            .filter(
                UserGame.user_id == user_id,
                DatabaseGame.bgg_id == bgg_id,
                DatabaseGame.is_expansion
                .is_(False),
            )
            .first()
        )

        if database_game is None:
            return None

        game = self._to_domain(
            database_game
        )

        game.owned = True

        return game


    def add_to_user_collection(
        self,
        user_id: int,
        bgg_id: int,
        source: str = "manual",
    ) -> bool:
        database_game = (
            self.db.query(DatabaseGame)
            .filter(
                DatabaseGame.bgg_id == bgg_id
            )
            .first()
        )

        if database_game is None:
            return False

        existing = (
            self.db.query(UserGame)
            .filter(
                UserGame.user_id == user_id,
                UserGame.game_id
                == database_game.id,
            )
            .first()
        )

        if existing is not None:
            return True

        self.db.add(
           UserGame(
                user_id=user_id,
                game_id=database_game.id,
                source=source,
            )
        )

        self.db.commit()

        return True

    def remove_from_user_collection(
        self,
        user_id: int,
        bgg_id: int,
    ) -> bool:
        membership = (
            self.db.query(UserGame)
            .join(
                DatabaseGame,
                DatabaseGame.id
                == UserGame.game_id,
            )
            .filter(
                UserGame.user_id == user_id,
                DatabaseGame.bgg_id == bgg_id,
            )
            .first()
        )

        if membership is None:
            return False

        self.db.delete(membership)
        self.db.commit()

        return True

    def get_wishlist_by_user(
        self,
        user_id: int,
    ) -> list[DomainGame]:
        database_games = (
            self.db.query(DatabaseGame)
            .join(
                UserWishlistGame,
                UserWishlistGame.game_id
                == DatabaseGame.id,
            )
            .filter(
                UserWishlistGame.user_id
                == user_id
            )
            .order_by(
                UserWishlistGame.added_at.desc()
            )
            .all()
        )

        games = [
            self._to_domain(game)
            for game in database_games
        ]

        for game in games:
            game.owned = False

        return games

    def get_wishlisted_by_bgg_id(
        self,
        user_id: int,
        bgg_id: int,
    ) -> DomainGame | None:
        database_game = (
            self.db.query(DatabaseGame)
            .join(
                UserWishlistGame,
                UserWishlistGame.game_id
                == DatabaseGame.id,
            )
            .filter(
                UserWishlistGame.user_id
                == user_id,
                DatabaseGame.bgg_id == bgg_id,
            )
            .first()
        )

        if database_game is None:
            return None

        game = self._to_domain(database_game)
        game.owned = False

        return game

    def get_wishlisted_bgg_ids(
        self,
        user_id: int,
    ) -> set[int]:
        rows = (
            self.db.query(DatabaseGame.bgg_id)
            .join(
                UserWishlistGame,
                UserWishlistGame.game_id
                == DatabaseGame.id,
            )
            .filter(
                UserWishlistGame.user_id
                == user_id
            )
            .all()
        )

        return {
            row[0]
            for row in rows
        }

    def add_to_wishlist(
        self,
        user_id: int,
        bgg_id: int,
    ) -> bool:
        database_game = (
            self.db.query(DatabaseGame)
            .filter(
                DatabaseGame.bgg_id == bgg_id
            )
            .first()
        )

        if database_game is None:
            return False

        existing = (
            self.db.query(UserWishlistGame)
            .filter(
                UserWishlistGame.user_id
                == user_id,
                UserWishlistGame.game_id
                == database_game.id,
            )
            .first()
        )

        if existing is not None:
            return True

        self.db.add(
            UserWishlistGame(
                user_id=user_id,
                game_id=database_game.id,
            )
        )
        self.db.commit()

        return True

    def remove_from_wishlist(
        self,
        user_id: int,
        bgg_id: int,
    ) -> bool:
        membership = (
            self.db.query(UserWishlistGame)
            .join(
                DatabaseGame,
                DatabaseGame.id
                == UserWishlistGame.game_id,
            )
            .filter(
                UserWishlistGame.user_id
                == user_id,
                DatabaseGame.bgg_id == bgg_id,
            )
            .first()
        )

        if membership is None:
            return False

        self.db.delete(membership)
        self.db.commit()

        return True

    def move_wishlist_to_collection(
        self,
        user_id: int,
        bgg_id: int,
    ) -> DomainGame | None:
        database_game = (
            self.db.query(DatabaseGame)
            .filter(
                DatabaseGame.bgg_id == bgg_id
            )
            .first()
        )

        if database_game is None:
            return None

        wishlist_membership = (
            self.db.query(UserWishlistGame)
            .filter(
                UserWishlistGame.user_id
                == user_id,
                UserWishlistGame.game_id
                == database_game.id,
            )
            .first()
        )

        ownership = (
            self.db.query(UserGame)
            .filter(
                UserGame.user_id == user_id,
                UserGame.game_id
                == database_game.id,
            )
            .first()
        )

        if (
            wishlist_membership is None
            and ownership is None
        ):
            return None

        try:
            if ownership is None:
                self.db.add(
                    UserGame(
                        user_id=user_id,
                        game_id=database_game.id,
                        source="manual",
                    )
                )

            if wishlist_membership is not None:
                self.db.delete(
                    wishlist_membership
                )

            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

        game = self._to_domain(database_game)
        game.owned = True

        return game
    
    def get_by_bgg_id(
        self,
        bgg_id: int,
    ) -> DomainGame | None:
        database_game = (
            self.db.query(DatabaseGame)
            .filter(
                DatabaseGame.bgg_id == bgg_id
            )
            .first()
        )

        if database_game is None:
            return None

        return self._to_domain(database_game)

    def get_all(
        self,
    ) -> list[DomainGame]:
        database_games = (
            self.db.query(DatabaseGame)
            .filter(
                DatabaseGame.is_expansion
                .is_(False)
            )
            .order_by(DatabaseGame.name)
            .all()
        )

        return [
            self._to_domain(game)
            for game in database_games
        ]

    def create(
        self,
        game: DomainGame,
    ) -> DomainGame:
        database_game = DatabaseGame(
            bgg_id=game.bgg_id,
            name=game.name,
            year_published=game.year_published,
            min_players=game.min_players,
            max_players=game.max_players,
            min_play_time=game.min_play_time,
            max_play_time=game.max_play_time,
            min_age=game.min_age,
            min_age_checked=(
                game.min_age_checked
            ),
            best_player_counts=(
                game.best_player_counts or []
            ),
            recommended_player_counts=(
                game.recommended_player_counts
                or []
            ),
            player_count_poll=(
                self._serialize_player_count_poll(
                    game.player_count_poll
                )
            ),
            complexity=game.complexity,
            rating=game.rating,
            is_expansion=game.is_expansion,
            expansion_checked=(
                game.expansion_checked
            ),
            designers=game.designers or [],
            publishers=game.publishers or [],
            credits_checked=game.credits_checked,
            owned=game.owned,
            image_url=game.image_url,
            thumbnail_url=game.thumbnail_url,
            categories=(
                self._get_or_create_categories(
                    game.categories or []
                )
            ),
            mechanics=(
                self._get_or_create_mechanics(
                    game.mechanics or []
                )
            ),
        )

        self.db.add(database_game)
        self._finish_write()
        self.db.refresh(database_game)

        return self._to_domain(database_game)

    def update(
        self,
        game: DomainGame,
    ) -> DomainGame | None:
        database_game = (
            self.db.query(DatabaseGame)
            .filter(
                DatabaseGame.bgg_id == game.bgg_id
            )
            .first()
        )

        if database_game is None:
            return None

        database_game.name = game.name
        database_game.year_published = (
            game.year_published
        )
        database_game.min_players = (
            game.min_players
        )
        database_game.max_players = (
            game.max_players
        )
        database_game.best_player_counts = (
            game.best_player_counts or []
        )

        database_game.recommended_player_counts = (
            game.recommended_player_counts
            or []
        )
        database_game.player_count_poll = (
            self._serialize_player_count_poll(
                game.player_count_poll
            )
        )
        database_game.min_play_time = (
            game.min_play_time
        )
        database_game.max_play_time = (
            game.max_play_time
        )
        database_game.min_age = (
            game.min_age
        )
        database_game.min_age_checked = (
            game.min_age_checked
        )
        database_game.complexity = (
            game.complexity
        )
        database_game.rating = game.rating
        database_game.is_expansion = (
            game.is_expansion
        )
        database_game.expansion_checked = (
            game.expansion_checked
        )
        database_game.designers = (
            game.designers or []
        )
        database_game.publishers = (
            game.publishers or []
        )
        database_game.credits_checked = (
            game.credits_checked
        )
        database_game.owned = game.owned
        database_game.image_url = (
            game.image_url
        )
        database_game.thumbnail_url = (
            game.thumbnail_url
        )

        database_game.categories = (
            self._get_or_create_categories(
                game.categories or []
            )
        )

        database_game.mechanics = (
            self._get_or_create_mechanics(
                game.mechanics or []
            )
        )

        self._finish_write()
        self.db.refresh(database_game)

        return self._to_domain(database_game)

    def delete(
        self,
        bgg_id: int,
    ) -> bool:
        database_game = (
            self.db.query(DatabaseGame)
            .filter(
                DatabaseGame.bgg_id == bgg_id
            )
            .first()
        )

        if database_game is None:
            return False

        self.db.delete(database_game)
        self._finish_write()

        return True

    def _get_or_create_categories(
        self,
        names: list[str],
    ) -> list[Category]:
        categories = []

        for name in names:
            cleaned_name = name.strip()

            if not cleaned_name:
                continue

            category = (
                self.db.query(Category)
                .filter(
                    Category.name == cleaned_name
                )
                .first()
            )

            if category is None:
                category = Category(
                    name=cleaned_name
                )
                self.db.add(category)

            categories.append(category)

        return categories

    def _get_or_create_mechanics(
        self,
        names: list[str],
    ) -> list[Mechanic]:
        mechanics = []

        for name in names:
            cleaned_name = name.strip()

            if not cleaned_name:
                continue

            mechanic = (
                self.db.query(Mechanic)
                .filter(
                    Mechanic.name == cleaned_name
                )
                .first()
            )

            if mechanic is None:
                mechanic = Mechanic(
                    name=cleaned_name
                )
                self.db.add(mechanic)

            mechanics.append(mechanic)

        return mechanics

    @staticmethod
    def _to_domain(
        database_game: DatabaseGame,
    ) -> DomainGame:
        return DomainGame(
            bgg_id=database_game.bgg_id,
            name=database_game.name,
            year_published=(
                database_game.year_published
            ),
            min_players=database_game.min_players,
            max_players=database_game.max_players,
            best_player_counts=(
                database_game.best_player_counts
                or []
            ),
            recommended_player_counts=(
                database_game
                .recommended_player_counts
                or []
            ),
            player_count_poll=(
                GameRepository
                ._deserialize_player_count_poll(
                    database_game.player_count_poll
                    or []
                )
            ),
            min_play_time=(
                database_game.min_play_time
            ),
            max_play_time=(
                database_game.max_play_time
            ),
            min_age=database_game.min_age,
            min_age_checked=(
                database_game.min_age_checked
            ),
            complexity=database_game.complexity,
            rating=database_game.rating,
            is_expansion=(
                database_game.is_expansion
            ),
            expansion_checked=(
                database_game
                .expansion_checked
            ),
            owned=database_game.owned,
            image_url=database_game.image_url,
            thumbnail_url=(
                database_game.thumbnail_url
            ),
            categories=[
                category.name
                for category
                in database_game.categories
            ],
            mechanics=[
                mechanic.name
                for mechanic
                in database_game.mechanics
            ],
            designers=(
                database_game.designers or []
            ),
            publishers=(
                database_game.publishers or []
            ),
            credits_checked=(
                database_game.credits_checked
            ),
        )

    @staticmethod
    def _serialize_player_count_poll(
        poll: list[PlayerCountPoll],
    ) -> list[dict[str, int]]:
        return [
            {
                "player_count": result.player_count,
                "best_votes": result.best_votes,
                "recommended_votes": (
                    result.recommended_votes
                ),
                "not_recommended_votes": (
                    result.not_recommended_votes
                ),
                "total_votes": result.total_votes,
            }
            for result in poll
        ]

    @staticmethod
    def _deserialize_player_count_poll(
        poll: list[dict[str, int]],
    ) -> list[PlayerCountPoll]:
        return [
            PlayerCountPoll(
                player_count=result["player_count"],
                best_votes=result["best_votes"],
                recommended_votes=(
                    result["recommended_votes"]
                ),
                not_recommended_votes=(
                    result["not_recommended_votes"]
                ),
                total_votes=result["total_votes"],
            )
            for result in poll
        ]

    def get_existing_bgg_ids(
        self,
        bgg_ids: list[int],
    ) -> set[int]:
        if not bgg_ids:
            return set()

        rows = (
            self.db.query(
                DatabaseGame.bgg_id
            )
            .filter(
                DatabaseGame.bgg_id.in_(
                    bgg_ids
                )
            )
            .all()
        )

        return {
            row[0]
            for row in rows
        }

    def get_bgg_ids_needing_player_count_poll_refresh(
        self,
        bgg_ids: list[int],
    ) -> set[int]:
        if not bgg_ids:
            return set()

        database_games = (
            self.db.query(DatabaseGame)
            .filter(
                DatabaseGame.bgg_id.in_(
                    bgg_ids
                )
            )
            .all()
        )

        return {
            game.bgg_id
            for game in database_games
            if not game.player_count_poll
        }

    def mark_as_expansions(
        self,
        bgg_ids: list[int],
    ) -> None:
        if not bgg_ids:
            return

        (
            self.db.query(DatabaseGame)
            .filter(
                DatabaseGame.bgg_id.in_(
                    bgg_ids
                )
            )
            .update(
                {
                    DatabaseGame.is_expansion:
                    True,
                    DatabaseGame.expansion_checked:
                    True,
                },
                synchronize_session=False,
            )
        )

        self._finish_write()

    def get_bgg_ids_needing_expansion_check(
        self,
        bgg_ids: list[int],
    ) -> set[int]:
        if not bgg_ids:
            return set()

        rows = (
            self.db.query(
                DatabaseGame.bgg_id
            )
            .filter(
                DatabaseGame.bgg_id.in_(
                    bgg_ids
                ),
                DatabaseGame
                .expansion_checked
                .is_(False),
            )
            .all()
        )

        return {
            row[0]
            for row in rows
        }

    def get_bgg_ids_needing_min_age_check(
        self,
        bgg_ids: list[int],
    ) -> set[int]:
        if not bgg_ids:
            return set()

        rows = (
            self.db.query(
                DatabaseGame.bgg_id
            )
            .filter(
                DatabaseGame.bgg_id.in_(
                    bgg_ids
                ),
                DatabaseGame
                .min_age_checked
                .is_(False),
            )
            .all()
        )

        return {
            row[0]
            for row in rows
        }

    def get_bgg_ids_needing_credits_refresh(
        self,
        bgg_ids: list[int],
    ) -> set[int]:
        if not bgg_ids:
            return set()

        rows = (
            self.db.query(DatabaseGame.bgg_id)
            .filter(
                DatabaseGame.bgg_id.in_(bgg_ids),
                DatabaseGame.credits_checked.is_(False),
            )
            .all()
        )

        return {row[0] for row in rows}

    def sync_user_collection(
        self,
        user_id: int,
        bgg_ids: list[int],
    ) -> None:
        existing_memberships = (
            self.db.query(UserGame)
            .filter(
                UserGame.user_id
                == user_id
            )
            .all()
        )

        if (
            not bgg_ids
            and existing_memberships
        ):
            # BGG returned no games at
            # all, but this user already
            # has a collection. Treat
            # this as a failed/partial
            # fetch rather than "the
            # user owns nothing now" --
            # otherwise a transient BGG
            # hiccup would silently wipe
            # their whole collection.
            raise ValueError(
                "BGG returned no games "
                "for this collection. "
                "Sync aborted to avoid "
                "clearing your existing "
                "collection -- please "
                "try again."
            )

        database_games = (
            self.db.query(DatabaseGame)
            .filter(
                DatabaseGame.bgg_id.in_(
                    bgg_ids
                )
            )
            .all()
            if bgg_ids
            else []
        )

        target_game_ids = {
            game.id
            for game in database_games
        }

        existing_game_ids = {
            membership.game_id
            for membership
            in existing_memberships
        }

        game_ids_to_add = (
            target_game_ids
            - existing_game_ids
        )

        memberships_to_remove = [
            membership
            for membership
            in existing_memberships
            if (
                membership.source
                == "bgg"
                and membership.game_id
                not in target_game_ids
            )
        ]

        for game_id in game_ids_to_add:
            self.db.add(
                UserGame(
                    user_id=user_id,
                    game_id=game_id,
                    source="bgg",
                )
            )

        for membership in (
            memberships_to_remove
        ):
            self.db.delete(
                membership
            )

        self._finish_write()
