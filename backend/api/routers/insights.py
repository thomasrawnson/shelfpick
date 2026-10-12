from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
)

from api.dependencies import (
    get_insights_service,
)
from services.insights_service import (
    InsightsService,
)


router = APIRouter()


@router.get("/insights")
def get_collection_insights(
    service: InsightsService = Depends(
        get_insights_service
    ),
):
    return (
        service.get_collection_insights()
    )


@router.get("/insights/monthly-recap")
def get_monthly_recap(
    month: str = Query(..., description="Calendar month in YYYY-MM format"),
    timezone: str = Query(..., description="IANA timezone name"),
    service: InsightsService = Depends(get_insights_service),
):
    try:
        return service.get_monthly_recap(month, timezone)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
