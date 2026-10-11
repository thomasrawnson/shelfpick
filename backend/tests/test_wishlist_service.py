import pytest

from models.game import Game
from services.wishlist_service import WishlistService


BASE_GAME_XML = """
<items>
  <item type="boardgame" id="42">
    <name type="primary" value="Base Game"/>
  </item>
</items>
"""

EXPANSION_XML = """
<items>
  <item type="boardgameexpansion" id="42">
    <name type="primary" value="Expansion"/>
  </item>
</items>
"""


class FakeBGGClient:
    def __init__(self, xml=BASE_GAME_XML):
        self.xml = xml
        self.requested_ids = []

    def get_game(self, bgg_id):
        self.requested_ids.append(bgg_id)
        return self.xml


class FakeRepository:
    def __init__(self, game=None):
        self.game = game
        self.created = []
        self.updated = []
        self.added = []

    def get_by_bgg_id(self, bgg_id):
        if self.game and self.game.bgg_id == bgg_id:
            return self.game
        return None

    def create(self, game):
        self.created.append(game)
        self.game = game
        return game

    def update(self, game):
        self.updated.append(game)
        self.game = game
        return game

    def add_to_wishlist(self, user_id, bgg_id):
        self.added.append((user_id, bgg_id))
        return True


def test_adds_valid_base_game_before_membership():
    client = FakeBGGClient()
    repository = FakeRepository()
    service = WishlistService(repository, client, user_id=7)

    game = service.add_game(42)

    assert game.name == "Base Game"
    assert client.requested_ids == [42]
    assert [created.bgg_id for created in repository.created] == [42]
    assert repository.added == [(7, 42)]


def test_existing_classified_base_game_does_not_require_bgg():
    client = FakeBGGClient()
    repository = FakeRepository(
        Game(
            bgg_id=42,
            name="Base Game",
            expansion_checked=True,
        )
    )

    WishlistService(repository, client, user_id=7).add_game(42)

    assert client.requested_ids == []
    assert repository.added == [(7, 42)]


@pytest.mark.parametrize(
    "existing",
    [
        None,
        Game(
            bgg_id=42,
            name="Unclassified",
            expansion_checked=False,
        ),
        Game(
            bgg_id=42,
            name="Expansion",
            is_expansion=True,
            expansion_checked=True,
        ),
    ],
)
def test_rejects_expansion_before_membership(existing):
    client = FakeBGGClient(EXPANSION_XML)
    repository = FakeRepository(existing)
    service = WishlistService(repository, client, user_id=7)

    with pytest.raises(
        ValueError,
        match="Expansions aren't added to Want to Play",
    ):
        service.add_game(42)

    assert repository.created == []
    assert repository.updated == []
    assert repository.added == []


def test_refreshes_incomplete_cached_metadata_before_membership():
    client = FakeBGGClient(BASE_GAME_XML)
    repository = FakeRepository(
        Game(
            bgg_id=42,
            name="Unclassified",
            expansion_checked=False,
        )
    )

    WishlistService(repository, client, user_id=7).add_game(42)

    assert client.requested_ids == [42]
    assert len(repository.updated) == 1
    assert repository.updated[0].expansion_checked is True
    assert repository.added == [(7, 42)]


@pytest.mark.parametrize(
    "xml",
    [
        "<items />",
        '<items><item type="boardgame" id="42" /></items>',
        BASE_GAME_XML.replace('id="42"', 'id="99"'),
    ],
)
def test_unknown_or_mismatched_metadata_fails_before_persistence(xml):
    client = FakeBGGClient(xml)
    repository = FakeRepository()
    service = WishlistService(repository, client, user_id=7)

    with pytest.raises(ValueError):
        service.add_game(42)

    assert repository.created == []
    assert repository.updated == []
    assert repository.added == []
