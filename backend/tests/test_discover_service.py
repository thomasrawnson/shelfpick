from models.game import Game
from models.game_play_stats import GamePlayStats
from bgg.client import BGGSourceUnavailableError
from services.discover_service import DiscoverService, MAX_RANKING_INFLUENCE
from services.discover_sources import DiscoverCandidate, DiscoverCandidateProvider


class FakeRepository:
    def __init__(self, owned=True):
        self.owned = owned

    def get_owned_by_user(self, user_id):
        return [
            Game(
                bgg_id=99,
                name="Owned",
                categories=["Strategy"],
                mechanics=["Deck Building"],
            )
        ] if self.owned else []

    def get_wishlisted_bgg_ids(self, user_id):
        return {1}


class FakePlayRepository:
    def __init__(
        self,
        player_count=2,
        play_time=60,
        play_count=4,
        player_count_source="history",
        play_time_source="history",
    ):
        self.play_count = play_count
        self.profile = {
            "typical_player_count": player_count,
            "typical_play_time": play_time,
            "player_count_source": player_count_source,
            "play_time_source": play_time_source,
        }

    def get_game_play_stats(self):
        return {99: GamePlayStats(99, self.play_count, None)}

    def get_discover_profile(self):
        return self.profile


class FakeRankingRepository:
    def __init__(self, games=None):
        self.games = games or []

    def get_discover_affinity_games(self):
        return self.games


class FakeCandidateProvider:
    candidates = [
        DiscoverCandidate(1, {"hot", "ranked"}, 1),
        DiscoverCandidate(2, {"ranked"}, 2),
        DiscoverCandidate(3, {"hot"}),
        DiscoverCandidate(4, {"hot"}),
        DiscoverCandidate(5, {"ranked"}, 150),
    ]

    def get_candidates(
        self,
        owned_bgg_ids,
        source_names=None,
        max_ranked_position=None,
    ):
        assert owned_bgg_ids in ({99}, set())
        return [
            candidate
            for candidate in self.candidates
            if (
                source_names is None
                or candidate.sources & source_names
            )
            and (
                max_ranked_position is None
                or (
                    type(candidate.ranked_position)
                    is int
                    and 1
                    <= candidate.ranked_position
                    <= max_ranked_position
                )
            )
        ]


class FakeBGGClient:
    def get_games(self, bgg_ids):
        items = []
        for bgg_id in bgg_ids:
            category = (
                '<link type="boardgamecategory" value="Strategy"/>'
                if bgg_id in {1, 4}
                else '<link type="boardgamecategory" value="Party"/>'
                if bgg_id == 3
                else ""
            )
            mechanic = (
                '<link type="boardgamemechanic" value="Deck Building"/>'
                if bgg_id == 1
                else ""
            )
            not_recommended = 15 if bgg_id == 4 else 4
            max_players = 4 if bgg_id != 2 else 1
            items.append(f"""
                <item type="boardgame" id="{bgg_id}">
                    <name type="primary" value="Game {bgg_id}"/>
                    <minplayers value="1"/>
                    <maxplayers value="{max_players}"/>
                    <maxplaytime value="60"/>
                    <statistics><ratings>
                        <average value="7"/>
                        <averageweight value="2.5"/>
                    </ratings></statistics>
                    <poll name="suggested_numplayers">
                        <results numplayers="2">
                            <result value="Best" numvotes="20"/>
                            <result value="Recommended" numvotes="10"/>
                            <result value="Not Recommended" numvotes="{not_recommended}"/>
                        </results>
                    </poll>
                    {category}{mechanic}
                </item>
            """)
        return "<items>" + "".join(items) + "</items>"


def make_service(play_repository=None, repository=None, ranking_repository=None):
    return DiscoverService(
        repository=repository or FakeRepository(),
        play_repository=play_repository or FakePlayRepository(),
        ranking_repository=ranking_repository or FakeRankingRepository(),
        bgg_client=FakeBGGClient(),
        candidate_provider=FakeCandidateProvider(),
        user_id=7,
    )


def test_hot_and_top100_do_not_read_personal_rankings():
    class RankingsMustNotBeRead:
        def get_discover_affinity_games(self):
            raise AssertionError("source modes must not query personal rankings")

    service = make_service(ranking_repository=RankingsMustNotBeRead())

    assert service.get_recommendations(mode="hot")
    assert service.get_recommendations(mode="top100")


def test_hot_and_top100_keep_sources_order_and_wishlist_state():
    hot = make_service().get_recommendations(mode="hot")
    ranked = make_service().get_recommendations(mode="top100")

    assert [item["game"].bgg_id for item in hot] == [1, 3, 4]
    assert [item["game"].bgg_id for item in ranked] == [1, 2]
    assert hot[0]["wishlisted"] is True
    assert ranked[0]["source_rank"] == 1
    assert hot[0]["reasons"] == ["Currently hot on BoardGameGeek"]


def test_for_you_uses_real_player_time_and_collection_signals():
    results = make_service().get_recommendations(mode="for_you")

    assert all(item["game"].bgg_id != 2 for item in results)
    assert all(item["game"].bgg_id != 4 for item in results)
    first = next(item for item in results if item["game"].bgg_id == 1)
    assert "Great at 2 players" in first["reasons"]
    assert "Fits your usual 60-minute session" in first["reasons"]
    assert "Matches Strategy games on your shelf" in first["reasons"]
    assert first["section"] == "Great at your usual player count"


def test_for_you_without_history_uses_a_matching_collection_signal():
    result = make_service(
        FakePlayRepository(player_count=None, play_time=None, play_count=0)
    ).get_recommendation_result(mode="for_you")

    assert result.personalisation == "personalised"
    assert result.signals == ("collection",)
    assert result.recommendations
    assert all(item["reasons"] for item in result.recommendations)
    assert any(
        "BoardGameGeek" in reason
        for item in result.recommendations
        for reason in item["reasons"]
    )


def test_for_you_empty_collection_uses_only_source_signals():
    result = make_service(
        FakePlayRepository(player_count=None, play_time=None, play_count=0),
        repository=FakeRepository(owned=False),
    ).get_recommendation_result(mode="for_you")

    assert result.personalisation == "popular_fallback"
    results = result.recommendations
    assert results
    assert all(item["section"] == "Popular starting points" for item in results)
    assert all(
        any("BoardGameGeek" in reason for reason in item["reasons"])
        for item in results
    )
    assert not any(
        "your shelf" in reason.lower()
        for item in results
        for reason in item["reasons"]
    )


def test_for_you_single_play_keeps_truthful_collection_and_session_reasons():
    result = make_service(
        FakePlayRepository(player_count=2, play_time=60, play_count=1)
    ).get_recommendation_result(mode="for_you")

    assert result.personalisation == "personalised"
    assert result.signals == ("collection", "play_history")
    results = result.recommendations
    first = next(item for item in results if item["game"].bgg_id == 1)
    assert "Matches Strategy games on your shelf" in first["reasons"]
    assert "Fits your usual 60-minute session" in first["reasons"]
    assert "Great at 2 players" in first["reasons"]


def test_for_you_explicit_preferences_are_reported_as_the_used_signal():
    result = make_service(FakePlayRepository(
        player_count=2,
        play_time=60,
        play_count=0,
        player_count_source="preference",
        play_time_source="preference",
    )).get_recommendation_result(mode="for_you")

    assert result.personalisation == "personalised"
    assert result.signals == ("collection", "preferences")


def test_for_you_stays_personalised_with_hot_only_source_fallback():
    class HotSource:
        name = "hot"

        def get_candidates(self):
            return [DiscoverCandidate(1, {"hot"})]

    class UnavailableRankedSource:
        name = "ranked"

        def get_candidates(self):
            raise BGGSourceUnavailableError(source="ranked", status_code=403)

    service = DiscoverService(
        repository=FakeRepository(),
        play_repository=FakePlayRepository(),
        ranking_repository=FakeRankingRepository(),
        bgg_client=FakeBGGClient(),
        candidate_provider=DiscoverCandidateProvider([
            HotSource(),
            UnavailableRankedSource(),
        ]),
        user_id=7,
    )

    result = service.get_recommendation_result(mode="for_you")

    assert result.personalisation == "personalised"
    assert result.recommendations
    assert result.recommendations[0]["reasons"][-1] == "Currently hot on BoardGameGeek"


def test_for_you_keeps_ranked_candidates_beyond_top_100():
    results = make_service().get_recommendations(
        mode="for_you",
    )

    assert any(
        item["game"].bgg_id == 5
        and item["source_rank"] == 150
        for item in results
    )


def ranking_games(strategy_high=True):
    high_name, low_name = (
        ("Strategy", "Party")
        if strategy_high
        else ("Party", "Strategy")
    )
    return [
        {
            "rating": rating,
            "comparisons_count": 3,
            "categories": [category],
            "mechanics": [],
        }
        for rating, category in [
            (1600, high_name),
            (1550, high_name),
            (1450, low_name),
            (1400, low_name),
        ]
    ]


def test_for_you_personal_rankings_add_a_bounded_explainable_affinity():
    play_repository = FakePlayRepository(
        player_count=None,
        play_time=None,
        play_count=0,
    )
    repository = FakeRepository(owned=False)
    baseline = make_service(
        play_repository,
        repository,
    ).get_recommendation_result(mode="for_you")
    ranked = make_service(
        play_repository,
        repository,
        FakeRankingRepository(ranking_games()),
    ).get_recommendation_result(mode="for_you")

    baseline_by_id = {
        item["game"].bgg_id: item
        for item in baseline.recommendations
    }
    ranked_by_id = {
        item["game"].bgg_id: item
        for item in ranked.recommendations
    }
    influence = ranked_by_id[1]["score"] - baseline_by_id[1]["score"]

    assert 0 < influence <= MAX_RANKING_INFLUENCE
    assert DiscoverService._ranking_influence(
        ranked_by_id[1]["game"],
        {"Strategy": 10.0},
        {},
    ) == MAX_RANKING_INFLUENCE
    assert "Similar to games you rank highly" in ranked_by_id[1]["reasons"]
    assert "Similar to games you rank highly" not in ranked_by_id[3]["reasons"]
    assert ranked.personalisation == "personalised"
    assert ranked.signals == ("rankings",)
    assert all("_ranking_contributed" not in item for item in ranked.recommendations)


def test_for_you_sparse_or_tied_rankings_are_neutral():
    play_repository = FakePlayRepository(
        player_count=None,
        play_time=None,
        play_count=0,
    )
    repository = FakeRepository(owned=False)
    baseline = make_service(
        play_repository,
        repository,
    ).get_recommendation_result(mode="for_you")
    sparse = make_service(
        play_repository,
        repository,
        FakeRankingRepository(ranking_games()[:3]),
    ).get_recommendation_result(mode="for_you")
    tied = make_service(
        play_repository,
        repository,
        FakeRankingRepository([
            {**game, "rating": 1500}
            for game in ranking_games()
        ]),
    ).get_recommendation_result(mode="for_you")

    def summary(result):
        return [
            (item["game"].bgg_id, item["score"], item["reasons"])
            for item in result.recommendations
        ]

    assert summary(sparse) == summary(baseline)
    assert summary(tied) == summary(baseline)
    assert "rankings" not in sparse.signals
    assert "rankings" not in tied.signals


def test_for_you_reads_current_ranking_order_without_caching_old_affinity():
    play_repository = FakePlayRepository(
        player_count=None,
        play_time=None,
        play_count=0,
    )
    ranking_repository = FakeRankingRepository(ranking_games())
    service = make_service(
        play_repository,
        FakeRepository(owned=False),
        ranking_repository,
    )

    first = service.get_recommendation_result(mode="for_you")
    ranking_repository.games = ranking_games(strategy_high=False)
    edited = service.get_recommendation_result(mode="for_you")

    assert first.recommendations[0]["game"].bgg_id == 1
    assert edited.recommendations[0]["game"].bgg_id == 3
    assert (
        "Similar to games you rank highly"
        in edited.recommendations[0]["reasons"]
    )


def test_ranking_affinity_cannot_restore_player_count_exclusions():
    ranked = make_service(
        ranking_repository=FakeRankingRepository(ranking_games()),
    ).get_recommendation_result(mode="for_you")

    assert all(item["game"].bgg_id not in {2, 4} for item in ranked.recommendations)
