from types import SimpleNamespace

from services.entitlements import (
    Feature,
    PlanTier,
    can_use,
    entitlements_for,
    resolve_tier,
)
from api.routers.auth import user_response
from api.dependencies import get_picker_personal_rankings


def test_free_is_safe_default_for_missing_or_unknown_tier():
    assert resolve_tier(SimpleNamespace()) is PlanTier.FREE
    assert resolve_tier(SimpleNamespace(tier="unknown")) is PlanTier.FREE


def test_pro_tier_resolves_and_uses_central_feature_map():
    user = SimpleNamespace(tier="PRO")

    assert resolve_tier(user) is PlanTier.PRO
    assert can_use(user, Feature.ADVANCED_STATS)
    assert Feature.ADVANCED_STATS in entitlements_for(user)


def test_game_night_capabilities_are_independent():
    free_user = SimpleNamespace(tier="FREE")
    pro_user = SimpleNamespace(tier="PRO")

    assert can_use(free_user, Feature.GAME_NIGHT_BASIC)
    assert not can_use(free_user, Feature.GAME_NIGHT_ENHANCED)
    assert can_use(pro_user, Feature.GAME_NIGHT_BASIC)
    assert can_use(pro_user, Feature.GAME_NIGHT_ENHANCED)


def test_frontend_user_response_uses_the_same_entitlement_rules():
    user = SimpleNamespace(
        id=1,
        email="free@example.com",
        display_name="Free User",
        bgg_username="free-user",
        email_verified_at=None,
        tier="FREE",
        onboarding_completed=True,
        preferred_player_count=None,
        preferred_play_time=None,
        preferred_play_style="any",
        profile_player_id=None,
        profile_player=None,
    )

    response = user_response(user)

    assert response.tier == "FREE"
    assert response.entitlements == [Feature.GAME_NIGHT_BASIC.value]


def test_picker_personal_rankings_are_loaded_for_pro_only():
    class RankingRepository:
        def __init__(self):
            self.calls = 0

        def get_compared_owned_games(self):
            self.calls += 1
            return [{"bgg_id": 1, "rating": 1512, "comparisons_count": 1}]

    repository = RankingRepository()

    assert get_picker_personal_rankings(
        SimpleNamespace(tier="FREE"),
        repository,
    ) == []
    assert repository.calls == 0
    assert get_picker_personal_rankings(
        SimpleNamespace(tier="PRO"),
        repository,
    )[0]["bgg_id"] == 1
    assert repository.calls == 1
