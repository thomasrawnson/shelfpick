from models.game import Game
from models.game import PlayerCountPoll
from services.collection_service import CollectionService



GAME_XML = """
<items>
    <item type="boardgame" id="174430">
        <name type="primary" value="Gloomhaven"/>
        <yearpublished value="2017"/>

        <minplayers value="1"/>
        <maxplayers value="4"/>

        <minplaytime value="60"/>
        <maxplaytime value="120"/>
        <minage value="14"/>

        <image>https://example.com/image.jpg</image>
        <thumbnail>https://example.com/thumb.jpg</thumbnail>

        <statistics>
            <ratings>
                <average value="8.5"/>
                <averageweight value="3.8"/>
            </ratings>
        </statistics>

        <link type="boardgamecategory" value="Adventure"/>
        <link type="boardgamecategory" value="Fantasy"/>
        <link type="boardgamemechanic" value="Cooperative Game"/>
        <link type="boardgamedesigner" value="Isaac Childres"/>
        <link type="boardgamepublisher" value="Cephalofair Games"/>

        <poll name="suggested_numplayers">
            <results numplayers="2">
                <result value="Best" numvotes="0"/>
                <result value="Recommended" numvotes="9"/>
                <result value="Not Recommended" numvotes="40"/>
            </results>
        </poll>
    </item>
</items>
"""


def test_sync_game_creates_new_game():
    class FakeBGGClient:
        def get_game(self, bgg_id):
            return GAME_XML

    class FakeRepository:
        def get_by_bgg_id(self, bgg_id):
            return None

        def create(self, game):
            return game

    service = CollectionService(
        FakeBGGClient(),
        FakeRepository(),
    )

    game = service.sync_game(174430)

    assert game.bgg_id == 174430
    assert game.name == "Gloomhaven"
    assert game.player_count_poll == [
        PlayerCountPoll(2, 0, 9, 40, 49)
    ]
    assert game.min_age == 14
    assert game.min_age_checked is True


def test_sync_game_updates_existing_game():
    class FakeBGGClient:
        def get_game(self, bgg_id):
            return GAME_XML

    class FakeRepository:
        def get_by_bgg_id(self, bgg_id):
            return Game(
                bgg_id=174430,
                name="Old Name",
            )

        def update(self, game):
            return game

        def sync_user_collection(
            self,
            user_id,
            bgg_ids,
        ):
            self.synced_user_id = user_id
            self.synced_bgg_ids = list(
                bgg_ids
            )

    service = CollectionService(
        FakeBGGClient(),
        FakeRepository(),
    )

    game = service.sync_game(174430)

    assert game.bgg_id == 174430
    assert game.name == "Gloomhaven"
    assert game.player_count_poll == [
        PlayerCountPoll(2, 0, 9, 40, 49)
    ]

def test_sync_collection():
    collection_xml = """
    <items>
        <item objectid="174430"/>
        <item objectid="167791"/>
    </items>
    """

    class FakeBGGClient:
        def get_collection(
            self,
            username,
        ):
            return collection_xml

        def get_games(
            self,
            bgg_ids,
        ):
            items = "".join(
                f"""
                <item
                    type="boardgame"
                    id="{bgg_id}"
                >
                    <name
                        type="primary"
                        value="Game {bgg_id}"
                    />
                </item>
                """
                for bgg_id
                in bgg_ids
            )

            return (
                f"<items>{items}</items>"
            )

    class FakeRepository:
        def __init__(self):
            self.games = {}

        def get_existing_bgg_ids(
            self,
            bgg_ids,
        ):
            return {
                bgg_id
                for bgg_id
                in bgg_ids
                if bgg_id in self.games
            }

        def get_bgg_ids_needing_player_count_poll_refresh(
            self,
            bgg_ids,
        ):
            return set()

        def get_bgg_ids_needing_expansion_check(
            self,
            bgg_ids,
        ):
            return set()

        def get_bgg_ids_needing_min_age_check(
            self,
            bgg_ids,
        ):
            return set()

        def get_by_bgg_id(
            self,
            bgg_id,
        ):
            return self.games.get(
                bgg_id
            )

        def create(
            self,
            game,
        ):
            self.games[
                game.bgg_id
            ] = game

            return game

        def update(
            self,
            game,
        ):
            self.games[
                game.bgg_id
            ] = game

            return game
        
        def sync_user_collection(
            self,
            user_id,
            bgg_ids,
        ):
            self.synced_user_id = user_id
            self.synced_bgg_ids = list(
                bgg_ids
            )

    service = CollectionService(
        FakeBGGClient(),
        FakeRepository(),
    )

    games = service.sync_collection(
        "tom"
    )

    assert len(games) == 2
    assert games[0].bgg_id == 174430
    assert games[1].bgg_id == 167791


def test_sync_collection_ignores_and_marks_expansions():
    collection_xml = """
    <items>
        <item
            objectid="174430"
            subtype="boardgame"
        />
        <item
            objectid="999999"
            subtype="boardgameexpansion"
        />
    </items>
    """

    class FakeBGGClient:
        def get_collection(
            self,
            username,
        ):
            return collection_xml

        def get_games(
            self,
            bgg_ids,
        ):
            assert bgg_ids == [174430]
            return GAME_XML

    class FakeRepository:
        def __init__(self):
            self.game = None
            self.marked_ids = []
            self.synced_ids = []

        def mark_as_expansions(
            self,
            bgg_ids,
        ):
            self.marked_ids = list(
                bgg_ids
            )

        def get_existing_bgg_ids(
            self,
            bgg_ids,
        ):
            return set()

        def get_bgg_ids_needing_player_count_poll_refresh(
            self,
            bgg_ids,
        ):
            return set()

        def get_bgg_ids_needing_expansion_check(
            self,
            bgg_ids,
        ):
            return set()

        def get_bgg_ids_needing_min_age_check(
            self,
            bgg_ids,
        ):
            return set()

        def create(self, game):
            self.game = game
            return game

        def update(self, game):
            self.game = game
            return game

        def get_by_bgg_id(
            self,
            bgg_id,
        ):
            if (
                self.game is not None
                and self.game.bgg_id
                == bgg_id
            ):
                return self.game

            return None

        def sync_user_collection(
            self,
            user_id,
            bgg_ids,
        ):
            self.synced_ids = list(
                bgg_ids
            )

    repository = FakeRepository()

    games = CollectionService(
        FakeBGGClient(),
        repository,
        user_id=7,
    ).sync_collection("tom")

    assert repository.marked_ids == [
        999999
    ]
    assert repository.synced_ids == [
        174430
    ]
    assert [
        game.bgg_id
        for game in games
    ] == [174430]

def test_sync_collection_batches_uncached_games():
    ids = list(range(1, 46))

    collection_xml = (
        "<items>"
        + "".join(
            (
                f'<item '
                f'objectid="{bgg_id}"/>'
            )
            for bgg_id in ids
        )
        + "</items>"
    )

    class FakeBGGClient:
        def __init__(self):
            self.batches = []

        def get_collection(
            self,
            username,
        ):
            return collection_xml

        def get_games(
            self,
            bgg_ids,
        ):
            self.batches.append(
                list(bgg_ids)
            )

            items = "".join(
                f"""
                <item
                    type="boardgame"
                    id="{bgg_id}"
                >
                    <name
                        type="primary"
                        value="Game {bgg_id}"
                    />
                </item>
                """
                for bgg_id
                in bgg_ids
            )

            return (
                f"<items>"
                f"{items}"
                f"</items>"
            )

    class FakeRepository:
        def __init__(self):
            self.games = {}

        def get_existing_bgg_ids(
            self,
            bgg_ids,
        ):
            return set()

        def get_bgg_ids_needing_player_count_poll_refresh(
            self,
            bgg_ids,
        ):
            return set()

        def get_bgg_ids_needing_expansion_check(
            self,
            bgg_ids,
        ):
            return set()

        def get_bgg_ids_needing_min_age_check(
            self,
            bgg_ids,
        ):
            return set()

        def get_by_bgg_id(
            self,
            bgg_id,
        ):
            return self.games.get(
                bgg_id
            )

        def create(
            self,
            game,
        ):
            self.games[
                game.bgg_id
            ] = game

            return game

        def update(
            self,
            game,
        ):
            self.games[
                game.bgg_id
            ] = game

            return game
        
        def sync_user_collection(
            self,
            user_id,
            bgg_ids,
        ):
            self.synced_user_id = user_id
            self.synced_bgg_ids = list(
                bgg_ids
            )
            
    bgg_client = (
        FakeBGGClient()
    )

    service = CollectionService(
        bgg_client,
        FakeRepository(),
    )

    games = (
        service.sync_collection(
            "tom"
        )
    )

    assert len(games) == 45

    assert len(
        bgg_client.batches
    ) == 3

    assert len(
        bgg_client.batches[0]
    ) == 20

    assert len(
        bgg_client.batches[1]
    ) == 20

    assert len(
        bgg_client.batches[2]
    ) == 5


def test_sync_collection_refreshes_legacy_player_count_poll():
    class FakeBGGClient:
        def __init__(self):
            self.requested_ids = []

        def get_collection(
            self,
            username,
        ):
            return (
                '<items><item objectid="174430"/></items>'
            )

        def get_games(
            self,
            bgg_ids,
        ):
            self.requested_ids.extend(
                bgg_ids
            )
            return GAME_XML

    class FakeRepository:
        def __init__(self):
            self.game = Game(
                bgg_id=174430,
                name="Legacy Gloomhaven",
                best_player_counts=[2],
            )

        def get_existing_bgg_ids(
            self,
            bgg_ids,
        ):
            return {174430}

        def get_bgg_ids_needing_player_count_poll_refresh(
            self,
            bgg_ids,
        ):
            return {174430}

        def get_bgg_ids_needing_expansion_check(
            self,
            bgg_ids,
        ):
            return set()

        def get_bgg_ids_needing_min_age_check(
            self,
            bgg_ids,
        ):
            return set()

        def get_by_bgg_id(
            self,
            bgg_id,
        ):
            return self.game

        def update(
            self,
            game,
        ):
            self.game = game
            return game

    client = FakeBGGClient()
    repository = FakeRepository()

    games = CollectionService(
        client,
        repository,
    ).sync_collection("tom")

    assert client.requested_ids == [174430]
    assert games[0].player_count_poll == [
        PlayerCountPoll(2, 0, 9, 40, 49)
    ]


def test_sync_collection_rechecks_legacy_expansion_status():
    expansion_xml = """
    <items>
        <item type="boardgame" id="999999">
            <name
                type="primary"
                value="Example Expansion"
            />
            <link
                type="boardgameexpansion"
                id="1"
                value="Base Game"
                inbound="true"
            />
        </item>
    </items>
    """

    class FakeBGGClient:
        def __init__(self):
            self.requested_ids = []

        def get_collection(
            self,
            username,
        ):
            return (
                '<items><item objectid="999999"/></items>'
            )

        def get_games(
            self,
            bgg_ids,
        ):
            self.requested_ids.extend(
                bgg_ids
            )
            return expansion_xml

    class FakeRepository:
        def __init__(self):
            self.game = Game(
                bgg_id=999999,
                name="Legacy Expansion",
                expansion_checked=False,
            )

        def get_existing_bgg_ids(
            self,
            bgg_ids,
        ):
            return {999999}

        def get_bgg_ids_needing_player_count_poll_refresh(
            self,
            bgg_ids,
        ):
            return set()

        def get_bgg_ids_needing_expansion_check(
            self,
            bgg_ids,
        ):
            return {999999}

        def get_bgg_ids_needing_min_age_check(
            self,
            bgg_ids,
        ):
            return set()

        def get_by_bgg_id(
            self,
            bgg_id,
        ):
            return self.game

        def update(
            self,
            game,
        ):
            self.game = game
            return game

    client = FakeBGGClient()
    repository = FakeRepository()

    games = CollectionService(
        client,
        repository,
    ).sync_collection("tom")

    assert client.requested_ids == [999999]
    assert games[0].is_expansion is True
    assert games[0].expansion_checked is True


def test_sync_collection_rechecks_legacy_min_age():
    class FakeBGGClient:
        def __init__(self):
            self.requested_ids = []

        def get_collection(
            self,
            username,
        ):
            return (
                '<items><item objectid="174430"/></items>'
            )

        def get_games(
            self,
            bgg_ids,
        ):
            self.requested_ids.extend(
                bgg_ids
            )
            return GAME_XML

    class FakeRepository:
        def __init__(self):
            self.game = Game(
                bgg_id=174430,
                name="Legacy Gloomhaven",
                min_age_checked=False,
            )

        def get_existing_bgg_ids(
            self,
            bgg_ids,
        ):
            return {174430}

        def get_bgg_ids_needing_player_count_poll_refresh(
            self,
            bgg_ids,
        ):
            return set()

        def get_bgg_ids_needing_expansion_check(
            self,
            bgg_ids,
        ):
            return set()

        def get_bgg_ids_needing_min_age_check(
            self,
            bgg_ids,
        ):
            return {174430}

        def get_by_bgg_id(
            self,
            bgg_id,
        ):
            return self.game

        def update(
            self,
            game,
        ):
            self.game = game
            return game

    client = FakeBGGClient()
    repository = FakeRepository()

    games = CollectionService(
        client,
        repository,
    ).sync_collection("tom")

    assert client.requested_ids == [174430]
    assert games[0].min_age == 14
    assert games[0].min_age_checked is True


def test_sync_collection_refreshes_legacy_credits():
    class FakeBGGClient:
        def __init__(self):
            self.requested_ids = []

        def get_collection(self, username):
            return '<items><item objectid="174430"/></items>'

        def get_games(self, bgg_ids):
            self.requested_ids.extend(bgg_ids)
            return GAME_XML

    class FakeRepository:
        def __init__(self):
            self.game = Game(
                bgg_id=174430,
                name="Legacy Gloomhaven",
                credits_checked=False,
            )

        def get_existing_bgg_ids(self, bgg_ids):
            return {174430}

        def get_bgg_ids_needing_player_count_poll_refresh(
            self,
            bgg_ids,
        ):
            return set()

        def get_bgg_ids_needing_expansion_check(
            self,
            bgg_ids,
        ):
            return set()

        def get_bgg_ids_needing_min_age_check(
            self,
            bgg_ids,
        ):
            return set()

        def get_bgg_ids_needing_credits_refresh(
            self,
            bgg_ids,
        ):
            return {174430}

        def get_by_bgg_id(self, bgg_id):
            return self.game

        def update(self, game):
            self.game = game
            return game

    client = FakeBGGClient()
    repository = FakeRepository()

    games = CollectionService(
        client,
        repository,
    ).sync_collection("tom")

    assert client.requested_ids == [174430]
    assert games[0].designers == ["Isaac Childres"]
    assert games[0].publishers == ["Cephalofair Games"]
    assert games[0].credits_checked is True

def test_search_games_marks_owned_and_wishlisted_results():
    search_xml = """
    <items>
        <item type="boardgame" id="1">
            <name type="primary" value="Owned Game"/>
            <yearpublished value="2020"/>
        </item>
        <item type="boardgame" id="2">
            <name type="primary" value="New Game"/>
            <yearpublished value="2021"/>
        </item>
    </items>
    """

    class FakeBGGClient:
        def search_games(self, query):
            assert query == "game"
            return search_xml

    class FakeRepository:
        def get_owned_by_user(self, user_id):
            assert user_id == 7
            return [
                Game(
                    bgg_id=1,
                    name="Owned Game",
                )
            ]

        def get_wishlisted_bgg_ids(self, user_id):
            assert user_id == 7
            return {1, 2}

    service = CollectionService(
        FakeBGGClient(),
        FakeRepository(),
        user_id=7,
    )

    results = service.search_games(
        " game "
    )

    assert results == [
        {
            "bgg_id": 1,
            "name": "Owned Game",
            "year_published": 2020,
            "owned": True,
            "wishlisted": True,
        },
        {
            "bgg_id": 2,
            "name": "New Game",
            "year_published": 2021,
            "owned": False,
            "wishlisted": True,
        },
    ]


def test_add_game_fetches_uncached_game():
    class FakeBGGClient:
        def __init__(self):
            self.requested_ids = []

        def get_game(self, bgg_id):
            self.requested_ids.append(
                bgg_id
            )
            return GAME_XML

    class FakeRepository:
        def __init__(self):
            self.game = None
            self.added = []

        def get_by_bgg_id(self, bgg_id):
            return self.game

        def create(self, game):
            self.game = game
            return game

        def add_to_user_collection(
            self,
            user_id,
            bgg_id,
            source="manual",
        ):
            self.added.append(
                (
                    user_id,
                    bgg_id,
                    source,
                )
            )
            return True

        def get_owned_by_bgg_id(
            self,
            user_id,
            bgg_id,
        ):
            self.game.owned = True
            return self.game

    client = FakeBGGClient()
    repository = FakeRepository()
    service = CollectionService(
        client,
        repository,
        user_id=7,
    )

    game = service.add_game(174430)

    assert client.requested_ids == [
        174430
    ]
    assert repository.added == [
        (7, 174430, "manual")
    ]
    assert game.bgg_id == 174430
    assert game.owned is True


def test_add_game_rejects_expansion():
    class FakeBGGClient:
        def get_game(self, bgg_id):
            return """
            <items>
                <item
                    type="boardgameexpansion"
                    id="999999"
                >
                    <name
                        type="primary"
                        value="Example Expansion"
                    />
                </item>
            </items>
            """

    class FakeRepository:
        def get_by_bgg_id(
            self,
            bgg_id,
        ):
            return None

        def create(self, game):
            raise AssertionError(
                "Expansion must not be created"
            )

    service = CollectionService(
        FakeBGGClient(),
        FakeRepository(),
        user_id=7,
    )

    try:
        service.add_game(999999)
    except ValueError as exc:
        assert str(exc) == (
            "Expansions aren't added "
            "to the collection."
        )
    else:
        raise AssertionError(
            "Expected expansion rejection"
        )
