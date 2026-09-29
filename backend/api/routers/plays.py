import logging

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from api.dependencies import (
    get_picker_analytics_repository,
    get_play_repository,
    get_play_service,
)
from repositories.picker_analytics_repository import (
    PickerAnalyticsRepository,
)

from repositories.play_repository import (
    PlayRepository,
)
from api.schemas.play import PlayCreate
from api.schemas.play import LiveTimerStart
from services.play_service import PlayService
from api.current_user import get_current_user
from database.models import User
from services.entitlements import Feature, can_use
from services.live_timer_service import LiveTimerService
from api.dependencies import get_live_timer_service


router = APIRouter()
logger = logging.getLogger(
    "boardgamepicker.picker_analytics"
)


@router.post(
    "/plays",
    status_code=201,
)
def record_play(
    play_data: PlayCreate,
    service: PlayService = Depends(
        get_play_service
    ),
    analytics_repository: PickerAnalyticsRepository = Depends(
        get_picker_analytics_repository
    ),
):
    try:
        play = service.record_play(
            bgg_id=play_data.bgg_id,
            played_at=play_data.played_at,
            duration_minutes=(
                play_data.duration_minutes
            ),
            participants=[
                participant.model_dump()
                for participant
                in play_data.participants
            ],
            location=play_data.location,
            timer_session_id=play_data.timer_session_id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    if play is None:
        raise HTTPException(
            status_code=404,
            detail="Game not found",
        )

    if play_data.picker_session_id:
        try:
            analytics_repository.record_event(
                public_id=(
                    play_data.picker_session_id
                ),
                event_type="log_play",
                bgg_id=play_data.bgg_id,
            )
        except Exception:
            logger.exception(
                "picker_play_analytics_failed"
            )

    return play


def require_live_timer(current_user: User) -> None:
    if not can_use(current_user, Feature.LIVE_PLAY_ENHANCEMENTS):
        raise HTTPException(status_code=403, detail="Live play timer requires Pro.")


@router.get("/play-timer")
def get_live_timer(
    current_user: User = Depends(get_current_user),
    service: LiveTimerService = Depends(get_live_timer_service),
):
    require_live_timer(current_user)
    return service.get_active()


@router.get("/play-timer/recovery")
def get_live_timer_recovery(
    current_user: User = Depends(get_current_user),
    service: LiveTimerService = Depends(get_live_timer_service),
):
    """Return only the signed-in account's retained timer for recovery UI.

    This read does not grant timer controls. Start, pause, resume, finish and
    discard remain independently protected by the Pro capability check.
    """
    return service.get_active()


@router.post("/play-timer/start", status_code=201)
def start_live_timer(
    data: LiveTimerStart,
    current_user: User = Depends(get_current_user),
    service: LiveTimerService = Depends(get_live_timer_service),
):
    require_live_timer(current_user)
    try:
        return service.start(data.bgg_id, data.participant_names, data.location)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/play-timer/pause")
def pause_live_timer(current_user: User = Depends(get_current_user), service: LiveTimerService = Depends(get_live_timer_service)):
    require_live_timer(current_user)
    try:
        return service.pause()
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/play-timer/resume")
def resume_live_timer(current_user: User = Depends(get_current_user), service: LiveTimerService = Depends(get_live_timer_service)):
    require_live_timer(current_user)
    try:
        return service.resume()
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/play-timer/finish")
def finish_live_timer(current_user: User = Depends(get_current_user), service: LiveTimerService = Depends(get_live_timer_service)):
    require_live_timer(current_user)
    try:
        return service.finish()
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/play-timer", status_code=204)
def discard_live_timer(current_user: User = Depends(get_current_user), service: LiveTimerService = Depends(get_live_timer_service)):
    require_live_timer(current_user)
    service.discard()

@router.get(
    "/players",
)
def get_players(
    repository: PlayRepository = Depends(
        get_play_repository
    ),
):
    return repository.get_players()

@router.get(
    "/players/{player_id}/stats",
)
def get_player_stats(
    player_id: int,
    repository: PlayRepository = Depends(
        get_play_repository
    ),
):
    stats = (
        repository.get_player_stats(
            player_id
        )
    )

    if stats is None:
        raise HTTPException(
            status_code=404,
            detail="Player not found",
        )

    return stats

@router.delete(
    "/plays/{play_id}",
)
def delete_play(
    play_id: int,
    service: PlayService = Depends(
        get_play_service
    ),
):
    deleted = (
        service.delete_play(
            play_id
        )
    )

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail="Play not found",
        )

    return {
        "message":
            "Play deleted"
    }
