from fastapi import APIRouter, Depends, HTTPException, Query, Response

from api.current_user import get_current_user
from config import settings
from database.models import User
from services.export_cover_service import (
    CoverUnavailableError,
    ExportCoverService,
    InvalidCoverURLError,
)


router = APIRouter(tags=["export configuration"])


def get_export_cover_service() -> ExportCoverService:
    return ExportCoverService()


@router.get("/export-cover")
def get_export_cover(
    url: str = Query(..., max_length=2048),
    _current_user: User = Depends(get_current_user),
    service: ExportCoverService = Depends(get_export_cover_service),
):
    """Serve a BGG cover same-origin so the browser can draw it into an export.

    BGG's image host sends no CORS headers, so a canvas cannot read its images
    directly. Gated by the same server flag as exported cover artwork.
    """
    if not settings.export_cover_artwork_enabled:
        raise HTTPException(status_code=404, detail="Cover export is not available.")
    try:
        body, content_type = service.fetch_cover(url)
    except InvalidCoverURLError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except CoverUnavailableError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return Response(
        content=body,
        media_type=content_type,
        headers={
            "Cache-Control": "private, max-age=86400",
            "X-Content-Type-Options": "nosniff",
        },
    )
