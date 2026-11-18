from fastapi import APIRouter, Depends, HTTPException, Query, Response

from api.current_user import get_current_user
from api.dependencies import get_scoresheet_service
from api.schemas.scoresheet import ScoresheetWrite
from database.models import User
from services.entitlements import Feature, can_use
from services.scoresheet_service import ScoresheetNotFound, ScoresheetService


router = APIRouter(tags=["scoresheets"])


def require_custom_scoresheets(
    current_user: User = Depends(get_current_user),
) -> None:
    if not can_use(current_user, Feature.CUSTOM_SCORESHEETS):
        raise HTTPException(
            status_code=403, detail="Custom scoresheets require Pro.",
        )


@router.get("/scoresheets")
def list_scoresheets(
    bgg_id: int = Query(gt=0),
    service: ScoresheetService = Depends(get_scoresheet_service),
):
    """Built-in sheets for a game, then the caller's own."""
    return service.list_for_game(bgg_id)


@router.get(
    "/scoresheets/mine",
    dependencies=[Depends(require_custom_scoresheets)],
)
def list_my_scoresheets(
    service: ScoresheetService = Depends(get_scoresheet_service),
):
    return service.list_mine()


@router.get("/scoresheets/{scoresheet_id}")
def get_scoresheet(
    scoresheet_id: int,
    version: int | None = Query(default=None, ge=1),
    service: ScoresheetService = Depends(get_scoresheet_service),
):
    try:
        return service.get(scoresheet_id, version)
    except ScoresheetNotFound:
        raise HTTPException(status_code=404, detail="Scoresheet not found") from None


@router.post(
    "/scoresheets",
    status_code=201,
    dependencies=[Depends(require_custom_scoresheets)],
)
def create_scoresheet(
    body: ScoresheetWrite,
    service: ScoresheetService = Depends(get_scoresheet_service),
):
    try:
        return service.create(body.schema_)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put(
    "/scoresheets/{scoresheet_id}",
    dependencies=[Depends(require_custom_scoresheets)],
)
def update_scoresheet(
    scoresheet_id: int,
    body: ScoresheetWrite,
    service: ScoresheetService = Depends(get_scoresheet_service),
):
    try:
        return service.update(scoresheet_id, body.schema_)
    except ScoresheetNotFound:
        raise HTTPException(status_code=404, detail="Scoresheet not found") from None
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete(
    "/scoresheets/{scoresheet_id}",
    status_code=204,
    dependencies=[Depends(require_custom_scoresheets)],
)
def delete_scoresheet(
    scoresheet_id: int,
    service: ScoresheetService = Depends(get_scoresheet_service),
):
    try:
        service.delete(scoresheet_id)
    except ScoresheetNotFound:
        raise HTTPException(status_code=404, detail="Scoresheet not found") from None
    return Response(status_code=204)
