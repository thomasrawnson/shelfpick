from bgg.client import BGGClient
from bgg.game_parser import parse_game_metadata
from repositories.game_repository import GameRepository


class WishlistGameNotFoundError(Exception):
    pass


class WishlistService:
    def __init__(
        self,
        repository: GameRepository,
        bgg_client: BGGClient,
        user_id: int,
    ):
        self.repository = repository
        self.bgg_client = bgg_client
        self.user_id = user_id

    def list_games(self):
        return self.repository.get_wishlist_by_user(
            self.user_id
        )

    def get_game(self, bgg_id: int):
        game = (
            self.repository
            .get_wishlisted_by_bgg_id(
                self.user_id,
                bgg_id,
            )
        )

        if game is None:
            raise WishlistGameNotFoundError

        return game

    def add_game(self, bgg_id: int):
        game = self.repository.get_by_bgg_id(
            bgg_id
        )

        if (
            game is None
            or not game.expansion_checked
        ):
            xml = self.bgg_client.get_game(
                bgg_id
            )
            game = parse_game_metadata(xml)

            if game.bgg_id != bgg_id:
                raise ValueError(
                    "BoardGameGeek returned "
                    "unexpected game metadata."
                )

            if game.is_expansion:
                raise ValueError(
                    "Expansions aren't added "
                    "to Want to Play."
                )

            existing = (
                self.repository
                .get_by_bgg_id(bgg_id)
            )

            if existing is None:
                self.repository.create(game)
            else:
                self.repository.update(game)

        elif game.is_expansion:
            raise ValueError(
                "Expansions aren't added "
                "to Want to Play."
            )

        added = self.repository.add_to_wishlist(
            self.user_id,
            bgg_id,
        )

        if not added:
            raise ValueError(
                "Unable to add game to wishlist"
            )

        return self.repository.get_by_bgg_id(
            bgg_id
        )

    def remove_game(self, bgg_id: int) -> bool:
        return self.repository.remove_from_wishlist(
            self.user_id,
            bgg_id,
        )

    def move_to_collection(self, bgg_id: int):
        game = (
            self.repository
            .move_wishlist_to_collection(
                self.user_id,
                bgg_id,
            )
        )

        if game is None:
            raise WishlistGameNotFoundError

        return game
