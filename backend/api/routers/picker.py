import logging

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
)

from api.dependencies import (
    get_game_service,
    get_picker_analytics_repository,
    get_picker_personal_rankings,
    get_play_repository,
)
from api.schemas.picker_analytics import (
    PickerEventCreate,
)
from repositories.picker_analytics_repository import (
    PickerAnalyticsRepository,
)
from repositories.play_repository import (
    PlayRepository,
)
from services.game_service import (
    GameService,
)
from services.picker_service import (
    PickerCriteria,
    PickerService,
)
from models.ai_picker import (
    AiPickerCandidate,
)
from services.ai_picker_service import (
    AiPickerService,
)
from services.ai_picker_provider import (
    build_ai_picker_provider,
)
from config import settings

router = APIRouter()
logger = logging.getLogger(
    "boardgamepicker.picker_analytics"
)


@router.get("/picker/options")
def get_picker_options(
    game_service: GameService = Depends(
        get_game_service
    ),
):
    games = game_service.get_games()

    categories = sorted(
        {
            category
            for game in games
            for category in (
                game.categories or []
            )
            if category.strip()
        },
        key=str.casefold,
    )

    mechanics = sorted(
        {
            mechanic
            for game in games
            for mechanic in (
                game.mechanics or []
            )
            if mechanic.strip()
        },
        key=str.casefold,
    )

    return {
        "categories": categories,
        "mechanics": mechanics,
    }


@router.get("/picker")
def pick_games(
    players: int = Query(
        ...,
        ge=1,
    ),
    player_ids: list[int] = Query(
        default=[],
    ),
    max_play_time: int | None = Query(
        None,
        ge=1,
    ),
    complexity_band: str | None = Query(
        None,
        pattern="^(light|medium|heavy)$",
    ),
    max_complexity: float | None = Query(
        None,
        ge=0,
        le=5,
    ),
    youngest_player_age: int | None = Query(
        None,
        ge=1,
        le=120,
    ),
    play_style: str = Query(
        "any",
        pattern=(
            "^(any|cooperative|competitive)$"
        ),
    ),
    preferred_categories: list[str] = Query(
        default=[],
    ),
    preferred_mechanics: list[str] = Query(
        default=[],
    ),
    mode: str = Query(
        "best_match",
        pattern=(
            "^(best_match|different|surprise)$"
        ),
    ),
    limit: int = Query(
        20,
        ge=1,
        le=50,
    ),
    include_guidance: bool = Query(
        False,
    ),
    game_service: GameService = Depends(
        get_game_service
    ),
    play_repository: PlayRepository = Depends(
        get_play_repository
    ),
    analytics_repository: PickerAnalyticsRepository = Depends(
        get_picker_analytics_repository
    ),
    personal_rankings: list[dict] = Depends(
        get_picker_personal_rankings
    ),
    mood: str | None = Query(
        None,
        max_length=300,
    ),
):
    if (
        len(player_ids)
        != len(set(player_ids))
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Player IDs must be unique."
            ),
        )

    if (
        len(player_ids)
        > players
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Selected players cannot "
                "exceed player count."
            ),
        )

    known_player_ids = {
        player["id"]
        for player
        in play_repository.get_players()
    }

    if any(
        player_id
        not in known_player_ids
        for player_id
        in player_ids
    ):
        raise HTTPException(
            status_code=400,
            detail="Unknown player.",
        )

    games = (
        game_service.get_games()
    )

    picker_service = (
        PickerService()
    )

    play_stats = (
        play_repository
        .get_game_play_stats()
    )

    group_play_stats = (
        play_repository
        .get_group_game_play_stats(
            player_ids
        )
        if player_ids
        else {}
    )

    criteria = PickerCriteria(
        players=players,
        max_play_time=max_play_time,
        complexity_band=complexity_band,
        max_complexity=max_complexity,
        youngest_player_age=(
            youngest_player_age
        ),
        play_style=play_style,
        preferred_categories=(
            preferred_categories
        ),
        preferred_mechanics=(
            preferred_mechanics
        ),
        player_ids=player_ids,
        mode=mode,
    )

    matches = (
        picker_service.rank_matches(
            games,
            criteria,
            play_stats=play_stats,
            group_play_stats=(
                group_play_stats
            ),
            personal_rankings=(
                []
                if player_ids
                else personal_rankings
            ),
        )
    )

    def build_response(
        results: list[dict],
    ):
        guidance = None

        if include_guidance and not results:
            no_match_guidance = (
                picker_service
                .get_no_match_guidance(
                    games,
                    criteria,
                )
            )

            guidance = {
                "owned_game_count": (
                    no_match_guidance
                    .owned_game_count
                ),
                "player_count_exclusions": (
                    no_match_guidance
                    .player_count_exclusions
                ),
                "can_relax_time": (
                    no_match_guidance
                    .can_relax_time
                ),
                "can_relax_complexity": (
                    no_match_guidance
                    .can_relax_complexity
                ),
                "can_relax_both": (
                    no_match_guidance
                    .can_relax_both
                ),
            }

        session_id = None

        try:
            session_id = (
                analytics_repository
                .create_session(
                    criteria={
                        "players": players,
                        "selected_player_count": len(
                            player_ids
                        ),
                        "max_play_time": max_play_time,
                        "complexity_band": complexity_band,
                        "max_complexity": max_complexity,
                        "youngest_player_age": (
                            youngest_player_age
                        ),
                        "play_style": play_style,
                        "preferred_categories": (
                            preferred_categories
                        ),
                        "preferred_mechanics": (
                            preferred_mechanics
                        ),
                        "mode": mode,
                        "advanced_filters_used": bool(
                            preferred_categories
                            or preferred_mechanics
                            or youngest_player_age
                            is not None
                        ),
                        "mood_used": bool(
                            mood and mood.strip()
                        ),
                    },
                    recommendation_bgg_ids=[
                        result["game"].bgg_id
                        for result in results
                    ],
                )
            )
        except Exception:
            logger.exception(
                "picker_analytics_session_failed"
            )

        if not include_guidance:
            return results

        return {
            "matches": results,
            "guidance": guidance,
            "session_id": session_id,
        }

    if (
        mood is None
        or not mood.strip()
    ):
        return build_response([
            {
                "game": match.game,
                "score": match.score,
                "reasons": match.reasons,
                "ai_used": False,
                "ai_explanation": None,
            }
            for match
            in matches[:limit]
        ])

    candidate_matches = (
        matches[:10]
    )

    candidates = [
        AiPickerCandidate(
            bgg_id=(
                match.game.bgg_id
            ),
            name=(
                match.game.name
            ),
            deterministic_score=(
                match.score
            ),
            min_players=(
                match.game.min_players
            ),
            max_players=(
                match.game.max_players
            ),
            min_play_time=(
                match.game.min_play_time
            ),
            max_play_time=(
                match.game.max_play_time
            ),
            complexity=(
                match.game.complexity
            ),
            categories=(
                match.game.categories
                or []
            ),
            mechanics=(
                match.game.mechanics
                or []
            ),
            deterministic_reasons=(
                match.reasons
            ),
        )
        for match
        in candidate_matches
    ]

    ai_result = (
        AiPickerService(
            provider = (
                build_ai_picker_provider()
                if settings.ai_picker_enabled
                else None
            )
        ).rerank(
            candidates,
            mood=mood,
        )
    )

    matches_by_bgg_id = {
        match.game.bgg_id:
            match
        for match
        in candidate_matches
    }

    results = []

    for recommendation in (
        ai_result.recommendations
    ):
        match = (
            matches_by_bgg_id.get(
                recommendation.bgg_id
            )
        )

        if match is None:
            continue

        results.append(
            {
                "game": match.game,
                "score": match.score,
                "reasons": match.reasons,
                "ai_used": (
                    ai_result.used_ai
                ),
                "ai_explanation": (
                    recommendation
                    .explanation
                ),
            }
        )

    return build_response(results)


@router.post(
    "/picker/events",
    status_code=204,
)
def record_picker_event(
    event: PickerEventCreate,
    repository: PickerAnalyticsRepository = Depends(
        get_picker_analytics_repository
    ),
):
    if not repository.record_event(
        public_id=event.session_id,
        event_type=event.event_type,
        bgg_id=event.bgg_id,
        position=event.position,
    ):
        raise HTTPException(
            status_code=404,
            detail="Picker session not found",
        )
