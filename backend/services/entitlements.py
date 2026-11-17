from enum import Enum


class PlanTier(str, Enum):
    FREE = "FREE"
    PRO = "PRO"


class Feature(str, Enum):
    PERSONALIZED_DISCOVER = "personalized_discover"
    ADVANCED_RECOMMENDATIONS = "advanced_recommendations"
    GAME_NIGHT_BASIC = "game_night_basic"
    GAME_NIGHT_ENHANCED = "game_night_enhanced"
    ADVANCED_STATS = "advanced_stats"
    LIVE_PLAY_ENHANCEMENTS = "live_play_enhancements"


FEATURES_BY_TIER: dict[PlanTier, frozenset[Feature]] = {
    # Phone voting hosting (game_night_enhanced) is free for every account.
    PlanTier.FREE: frozenset(
        {Feature.GAME_NIGHT_BASIC, Feature.GAME_NIGHT_ENHANCED}
    ),
    PlanTier.PRO: frozenset(Feature),
}


def resolve_tier(user) -> PlanTier:
    raw_tier = getattr(user, "tier", None)

    if isinstance(raw_tier, PlanTier):
        return raw_tier

    try:
        return PlanTier(str(raw_tier).upper())
    except (TypeError, ValueError):
        return PlanTier.FREE


def entitlements_for(user) -> list[Feature]:
    return sorted(
        FEATURES_BY_TIER[resolve_tier(user)],
        key=lambda feature: feature.value,
    )


def can_use(user, feature: Feature) -> bool:
    return feature in FEATURES_BY_TIER[resolve_tier(user)]
