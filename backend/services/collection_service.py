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
)

THING_BATCH_SIZE = 20


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

        expansion_ids = (
            parse_collection_expansion_ids(
                xml
            )
        )

        if expansion_ids:
            self.repository.mark_as_expansions(
                expansion_ids
            )

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

        self._sync_missing_games(
            metadata_ids
        )

        if (
            self.user_id
            is not None
        ):
            self.repository.sync_user_collection(
                self.user_id,
                bgg_ids,
            )

        games = []

        for bgg_id in bgg_ids:
            game = (
                self.repository
                .get_by_bgg_id(
                    bgg_id
                )
            )

            if game is not None:
                games.append(game)

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
            parse_search_results(
                xml
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
    ) -> None:
        for batch in (
            self._batches(
                bgg_ids,
                THING_BATCH_SIZE,
            )
        ):
            xml = (
                self.bgg_client
                .get_games(batch)
            )

            games = (
                parse_games_metadata(
                    xml
                )
            )

            for game in games:
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
