from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query

from api.current_user import get_current_user
from api.dependencies import get_stats_service
from database.models import User
from services.entitlements import Feature, can_use
from services.stats_service import StatsService

router = APIRouter(prefix="/stats", tags=["stats"])

PRO_MESSAGE = "Advanced stats require Pro."


def require_advanced_stats(
    current_user: User = Depends(get_current_user),
) -> None:
    if not can_use(current_user, Feature.ADVANCED_STATS):
        raise HTTPException(status_code=403, detail=PRO_MESSAGE)


def _filters(
    service: StatsService,
    user: User,
    timezone: str,
    date_from: date | None,
    date_to: date | None,
    player_id: int | None,
    location: str | None,
    player_count: int | None,
):
    """Build filters; any narrowing filter is a Pro capability."""
    narrowed = any(
        value is not None
        for value in (date_from, date_to, player_id, location, player_count)
    )
    if narrowed and not can_use(user, Feature.ADVANCED_STATS):
        raise HTTPException(status_code=403, detail=PRO_MESSAGE)
    try:
        return service.build_filters(
            timezone, date_from, date_to, player_id, location, player_count
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


def stats_filters(
    timezone: str = Query(..., description="IANA timezone name"),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    player_id: int | None = Query(None, ge=1),
    location: str | None = Query(None, max_length=200),
    player_count: int | None = Query(None, ge=1, le=100),
    service: StatsService = Depends(get_stats_service),
    current_user: User = Depends(get_current_user),
):
    return _filters(
        service, current_user, timezone, date_from, date_to,
        player_id, location, player_count,
    )


def _run(call):
    try:
        return call()
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/plays-per-month")
def plays_per_month(
    months: int = Query(12),
    filters=Depends(stats_filters),
    service: StatsService = Depends(get_stats_service),
):
    return _run(lambda: service.plays_per_month(filters, months))


@router.get("/heatmap")
def heatmap(
    year: int | None = Query(None),
    filters=Depends(stats_filters),
    service: StatsService = Depends(get_stats_service),
):
    return _run(lambda: service.heatmap(filters, year))


@router.get("/h-index")
def h_index(
    filters=Depends(stats_filters),
    service: StatsService = Depends(get_stats_service),
):
    return _run(lambda: service.h_index(filters))


@router.get("/streak")
def streak(
    filters=Depends(stats_filters),
    service: StatsService = Depends(get_stats_service),
):
    return _run(lambda: service.streak(filters))


@router.get("/records", dependencies=[Depends(require_advanced_stats)])
def records(
    limit: int = Query(50, ge=1, le=100),
    filters=Depends(stats_filters),
    service: StatsService = Depends(get_stats_service),
):
    return _run(lambda: service.records(filters, limit))


@router.get("/head-to-head", dependencies=[Depends(require_advanced_stats)])
def head_to_head(
    player_a: int = Query(..., ge=1),
    player_b: int = Query(..., ge=1),
    filters=Depends(stats_filters),
    service: StatsService = Depends(get_stats_service),
):
    return _run(lambda: service.head_to_head(player_a, player_b, filters))


@router.get("/filter-options", dependencies=[Depends(require_advanced_stats)])
def filter_options(
    timezone: str = Query(..., description="IANA timezone name"),
    service: StatsService = Depends(get_stats_service),
):
    return _run(lambda: service.filter_options(timezone))
