import time
from sqlalchemy import text

from bgg.client import BGGClient
from bgg.collection_parser import (
    parse_collection_expansion_ids,
    parse_collection_ids,
)
from bgg.game_parser import (
    parse_game_metadata,
    parse_games_metadata,
)
from repositories.game_repository import (
    GameRepository,
)
from bgg.search_parser import (
    parse_search_results,
    rank_search_results,
)

THING_BATCH_SIZE = 20
MAX_COLLECTION_GAMES = 5000
MAX_METADATA_REFRESH_GAMES = 1000
COLLECTION_SYNC_MAX_SECONDS = 90 * 60


class CollectionService:
    def __init__(
        self,
        bgg_client: BGGClient,
        repository: GameRepository,
        user_id: int | None = None,
    ):
        self.bgg_client = (
            bgg_client
        )
        self.repository = (
            repository
        )
        self.user_id = user_id


    def sync_game(
        self,
        bgg_id: int,
    ):
        xml = (
            self.bgg_client
            .get_game(bgg_id)
        )

        game = (
            parse_game_metadata(
                xml
            )
        )

        existing_game = (
            self.repository
            .get_by_bgg_id(
                game.bgg_id
            )
        )

        if existing_game is None:
            return (
                self.repository
                .create(game)
            )

        return (
            self.repository
            .update(game)
        )


    def sync_collection(
        self,
        username: str,
    ):
        deadline = time.monotonic() + COLLECTION_SYNC_MAX_SECONDS
        xml = (
            self.bgg_client
            .get_collection(
                username
            )
        )

        bgg_ids = (
            parse_collection_ids(
                xml
            )
        )

        if len(bgg_ids) > MAX_COLLECTION_GAMES:
            raise ValueError(
                "That collection is too large to sync safely. "
                f"ShelfPick supports up to {MAX_COLLECTION_GAMES} owned games."
            )

        expansion_ids = (
            parse_collection_expansion_ids(
                xml
            )
        )
        self._apply_database_deadline(deadline)

        existing_ids = (
            self.repository
            .get_existing_bgg_ids(
                bgg_ids
            )
        )

        missing_ids = [
            bgg_id
            for bgg_id in bgg_ids
            if bgg_id
            not in existing_ids
        ]

        poll_refresh_ids = (
            self.repository
            .get_bgg_ids_needing_player_count_poll_refresh(
                bgg_ids
            )
        )

        expansion_check_ids = (
            self.repository
            .get_bgg_ids_needing_expansion_check(
                bgg_ids
            )
        )

        min_age_check_ids = (
            self.repository
            .get_bgg_ids_needing_min_age_check(
                bgg_ids
            )
        )

        credits_refresh_ids = (
            self.repository
            .get_bgg_ids_needing_credits_refresh(
                bgg_ids
            )
            if hasattr(
                self.repository,
                "get_bgg_ids_needing_credits_refresh",
            )
            else set()
        )

        metadata_refresh_ids = (
            set(missing_ids)
            | poll_refresh_ids
            | expansion_check_ids
            | min_age_check_ids
            | credits_refresh_ids
        )

        metadata_ids = [
            bgg_id
            for bgg_id in bgg_ids
            if (
                bgg_id
                in metadata_refresh_ids
            )
        ]

        if len(metadata_ids) > MAX_METADATA_REFRESH_GAMES:
            raise ValueError(
                "That sync needs too many game updates at once. "
                "Please contact support before trying again."
            )

        atomic_repository = hasattr(self.repository, "autocommit")
        previous_autocommit = getattr(self.repository, "autocommit", True)
        if atomic_repository:
            self.repository.autocommit = False
        try:
            if expansion_ids:
                self.repository.mark_as_expansions(expansion_ids)

            self._sync_missing_games(metadata_ids, deadline=deadline)

            self._apply_database_deadline(deadline)
            if self.user_id is not None:
                self.repository.sync_user_collection(self.user_id, bgg_ids)

            games = []
            for bgg_id in bgg_ids:
                self._check_deadline(deadline)
                self._apply_database_deadline(deadline)
                game = self.repository.get_by_bgg_id(bgg_id)
                if game is not None:
                    games.append(game)

            if atomic_repository:
                self.repository.db.commit()
        except Exception:
            if atomic_repository:
                self.repository.db.rollback()
            raise
        finally:
            if atomic_repository:
                self.repository.autocommit = previous_autocommit

        return games

    def search_games(
        self,
        query: str,
    ) -> list[dict]:
        cleaned_query = (
            query.strip()
        )

        if len(cleaned_query) < 2:
            return []

        xml = (
            self.bgg_client
            .search_games(
                cleaned_query
            )
        )

        results = (
            rank_search_results(
                parse_search_results(xml),
                cleaned_query,
            )
        )

        if self.user_id is None:
            return results[:20]

        owned_ids = {
            game.bgg_id
            for game
            in self.repository
            .get_owned_by_user(
                self.user_id
            )
        }

        wishlisted_ids = (
            self.repository
            .get_wishlisted_bgg_ids(
                self.user_id
            )
        )

        return [
            {
                **result,
                "owned": (
                    result["bgg_id"]
                    in owned_ids
                ),
                "wishlisted": (
                    result["bgg_id"]
                    in wishlisted_ids
                ),
            }
            for result
            in results[:20]
        ]


    def add_game(
        self,
        bgg_id: int,
    ):
        if self.user_id is None:
            raise ValueError(
                "User is required"
            )

        existing_game = (
            self.repository
            .get_by_bgg_id(
                bgg_id
            )
        )

        if existing_game is None:
            xml = (
                self.bgg_client
                .get_game(
                    bgg_id
                )
            )

            game = (
                parse_game_metadata(
                    xml
                )
            )

            if game.is_expansion:
                raise ValueError(
                    "Expansions aren't added "
                    "to the collection."
                )

            self.repository.create(
                game
            )

        elif existing_game.is_expansion:
            raise ValueError(
                "Expansions aren't added "
                "to the collection."
            )

        added = (
            self.repository
            .add_to_user_collection(
                self.user_id,
                bgg_id,
                source="manual",
            )
        )

        if not added:
            raise ValueError(
                "Unable to add game "
                "to collection"
            )

        return (
            self.repository
            .get_owned_by_bgg_id(
                self.user_id,
                bgg_id,
            )
        )

    def _sync_missing_games(
        self,
        bgg_ids: list[int],
        deadline: float | None = None,
    ) -> None:
        for batch in (
            self._batches(
                bgg_ids,
                THING_BATCH_SIZE,
            )
        ):
            self._check_deadline(deadline)
            xml = (
                self.bgg_client
                .get_games(batch)
            )
            self._check_deadline(deadline)

            games = (
                parse_games_metadata(
                    xml
                )
            )

            for game in games:
                self._check_deadline(deadline)
                self._apply_database_deadline(deadline)
                existing_game = (
                    self.repository
                    .get_by_bgg_id(
                        game.bgg_id
                    )
                )

                if (
                    existing_game
                    is None
                ):
                    self.repository.create(
                        game
                    )
                else:
                    self.repository.update(
                        game
                    )

    @staticmethod
    def _check_deadline(deadline: float | None) -> None:
        if deadline is not None and time.monotonic() > deadline:
            raise RuntimeError("Collection sync exceeded the safe time limit")

    def _apply_database_deadline(self, deadline: float) -> None:
        db = getattr(self.repository, "db", None)
        if db is None or db.get_bind().dialect.name != "postgresql":
            return
        remaining_ms = max(1, int((deadline - time.monotonic()) * 1000))
        self._check_deadline(deadline)
        lock_ms = min(30_000, remaining_ms)
        db.execute(
            text("SELECT set_config('statement_timeout', :value, true)"),
            {"value": f"{remaining_ms}ms"},
        )
        db.execute(
            text("SELECT set_config('lock_timeout', :value, true)"),
            {"value": f"{lock_ms}ms"},
        )


    @staticmethod
    def _batches(
        values: list[int],
        size: int,
    ):
        for index in range(
            0,
            len(values),
            size,
        ):
            yield values[
                index:
                index + size
            ]
