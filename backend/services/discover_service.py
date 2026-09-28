from collections import Counter
from dataclasses import dataclass
from dataclasses import replace

from bgg.client import BGGClient
from bgg.game_parser import parse_games_metadata
from repositories.game_repository import GameRepository
from repositories.play_repository import PlayRepository
from repositories.ranking_repository import RankingRepository
from services.discover_sources import DiscoverCandidate, DiscoverCandidateProvider
from services.picker_service import PickerCriteria, PickerService


DISCOVER_MODES = {"hot", "top100", "for_you"}
TOP_RANKED_POSITION = 100
MIN_RANKED_GAMES_FOR_AFFINITY = 4
RANKING_CONFIDENCE_COMPARISONS = 3
MAX_RANKING_INFLUENCE = 3.0


@dataclass(frozen=True)
class DiscoverRecommendationResult:
    recommendations: list[dict]
    personalisation: str
    signals: tuple[str, ...] = ()


class DiscoverService:
    def __init__(
        self,
        repository: GameRepository,
        play_repository: PlayRepository,
        ranking_repository: RankingRepository,
        bgg_client: BGGClient,
        candidate_provider: DiscoverCandidateProvider,
        user_id: int,
    ):
        self.repository = repository
        self.play_repository = play_repository
        self.ranking_repository = ranking_repository
        self.bgg_client = bgg_client
        self.candidate_provider = candidate_provider
        self.user_id = user_id

    def get_recommendations(self, mode: str = "hot", limit: int = 10) -> list[dict]:
        return self.get_recommendation_result(mode, limit).recommendations

    def get_recommendation_result(
        self,
        mode: str = "hot",
        limit: int = 10,
    ) -> DiscoverRecommendationResult:
        if mode not in DISCOVER_MODES:
            raise ValueError("Unknown Discover mode")

        owned_games = self.repository.get_owned_by_user(self.user_id)
        owned_bgg_ids = {game.bgg_id for game in owned_games}
        source_names = {
            "hot": {"hot"},
            "top100": {"ranked"},
            "for_you": {"hot", "ranked"},
        }[mode]
        source_candidates = self.candidate_provider.get_candidates(
            owned_bgg_ids,
            source_names=source_names,
            max_ranked_position=(
                TOP_RANKED_POSITION
                if mode == "top100"
                else None
            ),
        )[:30]
        candidates = self._load_metadata(source_candidates)
        wishlisted_ids = self.repository.get_wishlisted_bgg_ids(self.user_id)

        if mode != "for_you":
            return DiscoverRecommendationResult(
                recommendations=self._source_recommendations(
                    candidates, source_candidates, wishlisted_ids, mode, limit
                ),
                personalisation="not_applicable",
            )

        return self._personalized_recommendations(
            candidates,
            source_candidates,
            owned_games,
            wishlisted_ids,
            limit,
        )

    def _load_metadata(
        self,
        source_candidates: list[DiscoverCandidate],
    ) -> list:
        candidate_ids = [candidate.bgg_id for candidate in source_candidates]
        games = []

        for index in range(0, len(candidate_ids), 20):
            batch = candidate_ids[index:index + 20]
            if batch:
                games.extend(parse_games_metadata(self.bgg_client.get_games(batch)))

        game_by_id = {game.bgg_id: game for game in games}
        return [
            game_by_id[candidate.bgg_id]
            for candidate in source_candidates
            if candidate.bgg_id in game_by_id
        ]

    @staticmethod
    def _source_recommendations(
        games,
        source_candidates: list[DiscoverCandidate],
        wishlisted_ids: set[int],
        mode: str,
        limit: int,
    ) -> list[dict]:
        source_by_id = {candidate.bgg_id: candidate for candidate in source_candidates}
        results = []

        for game in games[:limit]:
            source = source_by_id[game.bgg_id]
            results.append({
                "game": game,
                "score": 0,
                "reasons": [
                    "Currently hot on BoardGameGeek"
                    if mode == "hot"
                    else "Highly ranked on BoardGameGeek"
                ],
                "wishlisted": game.bgg_id in wishlisted_ids,
                "source_rank": source.ranked_position,
                "section": None,
            })

        return results

    def _personalized_recommendations(
        self,
        games,
        source_candidates: list[DiscoverCandidate],
        owned_games,
        wishlisted_ids: set[int],
        limit: int,
    ) -> DiscoverRecommendationResult:
        play_stats = self.play_repository.get_game_play_stats()
        profile = self.play_repository.get_discover_profile()
        typical_players = profile["typical_player_count"]
        typical_time = profile["typical_play_time"]
        player_count_source = profile.get("player_count_source", "history")
        play_time_source = profile.get("play_time_source", "history")
        source_by_id = {candidate.bgg_id: candidate for candidate in source_candidates}
        signals: set[str] = set()
        category_rank_affinity, mechanic_rank_affinity = self._ranking_affinities(
            self.ranking_repository.get_compared_owned_games()
        )

        category_weights: Counter[str] = Counter()
        mechanic_weights: Counter[str] = Counter()
        for game in owned_games:
            history_weight = max(
                1,
                play_stats.get(game.bgg_id).play_count
                if game.bgg_id in play_stats
                else 1,
            )
            category_weights.update({category: history_weight for category in game.categories})
            mechanic_weights.update({mechanic: history_weight for mechanic in game.mechanics})

        if typical_players is not None:
            eligible_ids = {
                game.bgg_id
                for game in PickerService().find_matches(
                    [replace(game, owned=True) for game in games],
                    PickerCriteria(players=typical_players),
                )
            }
            games = [game for game in games if game.bgg_id in eligible_ids]
            if games:
                signals.add(
                    "preferences"
                    if player_count_source == "preference"
                    else "play_history"
                )

        recommendations = []
        for game in games:
            score = (game.rating or 0) / 2
            reasons: list[str] = []
            section = "Popular starting points"
            source = source_by_id[game.bgg_id]

            category_matches = [category for category in game.categories if category in category_weights]
            mechanic_matches = [mechanic for mechanic in game.mechanics if mechanic in mechanic_weights]
            if category_matches:
                best = max(category_matches, key=category_weights.get)
                score += category_weights[best]
                reasons.append(f"Matches {best} games on your shelf")
                section = "Matches your collection"
                signals.add("collection")
                if category_weights[best] > 1:
                    signals.add("play_history")
            if mechanic_matches:
                best = max(mechanic_matches, key=mechanic_weights.get)
                score += mechanic_weights[best] * 1.5
                reasons.append(f"Includes {best} from games on your shelf")
                section = "Matches your collection"
                signals.add("collection")
                if mechanic_weights[best] > 1:
                    signals.add("play_history")

            ranking_influence = self._ranking_influence(
                game,
                category_rank_affinity,
                mechanic_rank_affinity,
            )
            if ranking_influence > 0:
                score += ranking_influence
                reasons.append("Similar to games you rank highly")
                section = "Matches your personal rankings"

            if typical_time is not None and game.max_play_time is not None:
                if game.max_play_time <= typical_time:
                    score += 1.5
                    reasons.append(f"Fits your usual {typical_time}-minute session")
                    section = "Fits your usual session"
                    signals.add(
                        "preferences"
                        if play_time_source == "preference"
                        else "play_history"
                    )

            if typical_players is not None:
                if typical_players in game.best_player_counts:
                    score += 4
                    reasons.append(f"Great at {typical_players} players")
                    section = "Great at your usual player count"
                elif typical_players in game.recommended_player_counts:
                    score += 2
                    reasons.append(f"Recommended at {typical_players} players")
                    section = "Great at your usual player count"

            if source.sources == {"hot", "ranked"}:
                score += 0.5
                reasons.append(
                    "Both currently hot and highly ranked on BoardGameGeek"
                )
            elif "hot" in source.sources:
                score += 0.3
                reasons.append("Currently hot on BoardGameGeek")
            elif "ranked" in source.sources:
                score += 0.2
                reasons.append("Highly ranked on BoardGameGeek")

            if not reasons:
                reasons.append("Popular on BoardGameGeek")

            recommendations.append({
                "game": game,
                "score": round(score, 2),
                "reasons": reasons,
                "wishlisted": game.bgg_id in wishlisted_ids,
                "source_rank": source.ranked_position,
                "section": section,
                "_ranking_contributed": ranking_influence > 0,
            })

        recommendations.sort(key=lambda item: (-item["score"], item["game"].name))
        recommendations = recommendations[:limit]
        ranking_contributions = [
            item.pop("_ranking_contributed")
            for item in recommendations
        ]
        if any(ranking_contributions):
            signals.add("rankings")
        return DiscoverRecommendationResult(
            recommendations=recommendations,
            personalisation=(
                "personalised"
                if signals
                else "popular_fallback"
            ),
            signals=tuple(sorted(signals)),
        )

    @staticmethod
    def _ranking_affinities(
        ranked_games: list[dict],
    ) -> tuple[dict[str, float], dict[str, float]]:
        if len(ranked_games) < MIN_RANKED_GAMES_FOR_AFFINITY:
            return {}, {}

        ratings = [float(game["rating"]) for game in ranked_games]
        lowest = min(ratings)
        highest = max(ratings)
        if highest <= lowest:
            return {}, {}

        midpoint = (highest + lowest) / 2
        half_span = (highest - lowest) / 2
        category_values: dict[str, list[float]] = {}
        mechanic_values: dict[str, list[float]] = {}

        for game in ranked_games:
            confidence = min(
                int(game["comparisons_count"]) / RANKING_CONFIDENCE_COMPARISONS,
                1.0,
            )
            preference = ((float(game["rating"]) - midpoint) / half_span) * confidence
            for category in set(game.get("categories", [])):
                category_values.setdefault(category, []).append(preference)
            for mechanic in set(game.get("mechanics", [])):
                mechanic_values.setdefault(mechanic, []).append(preference)

        def averages(values: dict[str, list[float]]) -> dict[str, float]:
            return {
                name: sum(weights) / len(weights)
                for name, weights in values.items()
            }

        return averages(category_values), averages(mechanic_values)

    @staticmethod
    def _ranking_influence(
        game,
        category_affinity: dict[str, float],
        mechanic_affinity: dict[str, float],
    ) -> float:
        matches = [
            *(
                category_affinity[category]
                for category in set(game.categories)
                if category in category_affinity
            ),
            *(
                mechanic_affinity[mechanic]
                for mechanic in set(game.mechanics)
                if mechanic in mechanic_affinity
            ),
        ]
        if not matches:
            return 0.0

        # Low-ranked matches counter high-ranked ones. Only positive net affinity
        # adds score, so unranked/neutral metadata is never treated as dislike.
        net_affinity = max(0.0, sum(matches) / len(matches))
        return round(
            min(
                MAX_RANKING_INFLUENCE,
                net_affinity * MAX_RANKING_INFLUENCE,
            ),
            2,
        )
