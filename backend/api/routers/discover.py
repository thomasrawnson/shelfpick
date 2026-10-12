import xml.etree.ElementTree as ET
from typing import Literal

import httpx
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Response,
)

from api.dependencies import (
    get_discover_service,
)
from api.current_user import get_current_user
from database.models import User
from services.entitlements import Feature, can_use
from services.discover_service import (
    DiscoverService,
)


router = APIRouter()


@router.get(
    "/discover"
)
def get_discover_recommendations(
    response: Response,
    mode: Literal["hot", "top100", "for_you"] = Query("hot"),
    limit: int = Query(
        10,
        ge=1,
        le=20,
    ),
    service: DiscoverService = Depends(
        get_discover_service
    ),
    current_user: User = Depends(get_current_user),
):
    if mode == "top100":
        raise HTTPException(
            status_code=503,
            detail="Top 100 is temporarily unavailable during private beta.",
        )

    if mode == "for_you" and not can_use(
        current_user,
        Feature.PERSONALIZED_DISCOVER,
    ):
        raise HTTPException(
            status_code=403,
            detail="Personalised Discover requires ShelfPick Pro.",
        )

    try:
        result = service.get_recommendation_result(
            mode=mode,
            limit=limit,
        )
        response.headers["X-ShelfPick-Personalisation"] = result.personalisation
        response.headers["X-ShelfPick-Personalisation-Signals"] = ",".join(result.signals)
        return result.recommendations
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=504,
            detail=(
                "BoardGameGeek took too long "
                "to respond. Please try again."
            ),
        ) from exc
    except (
        httpx.HTTPStatusError,
        RuntimeError,
        ET.ParseError,
        ValueError,
    ) as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Recommendations are temporarily "
                "unavailable. Please try again."
            ),
        ) from exc
