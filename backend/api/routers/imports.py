import json

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)

from api.dependencies import (
    get_bgstats_play_import_service,
)
from services.bgstats_play_import_service import (
    BGStatsPlayImportService,
)
from bgstats.play_parser import BGStatsImportLimitError


router = APIRouter()
MAX_BGSTATS_UPLOAD_BYTES = 10 * 1024 * 1024


@router.post(
    "/imports/bgstats/plays"
)
async def import_bgstats_plays(
    file: UploadFile = File(...),
    service: BGStatsPlayImportService = Depends(
        get_bgstats_play_import_service
    ),
):
    filename = file.filename or ""

    if not filename.lower().endswith(
        ".json"
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "BG Stats export must be "
                "a JSON file"
            ),
        )

    contents = await file.read(MAX_BGSTATS_UPLOAD_BYTES + 1)
    if len(contents) > MAX_BGSTATS_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="BG Stats export must be 10 MB or smaller",
        )

    try:
        json_text = contents.decode(
            "utf-8"
        )
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unable to read JSON file"
            ),
        ) from exc

    try:
        result = service.import_plays(
            json_text
        )
    except BGStatsImportLimitError as exc:
        raise HTTPException(
            status_code=413,
            detail=str(exc),
        ) from exc
    except (
        json.JSONDecodeError,
        KeyError,
        TypeError,
        ValueError,
    ) as exc:
        raise HTTPException(
            status_code=400,
            detail=(
                "That file is not a valid "
                "BG Stats JSON export"
            ),
        ) from exc

    return {
        "imported": result.imported,
        "skipped_existing": (
            result.skipped_existing
        ),
        "skipped_missing_game": (
            result.skipped_missing_game
        ),
    }
