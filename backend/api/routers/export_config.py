from fastapi import APIRouter

from config import settings


router = APIRouter(tags=["export configuration"])


@router.get("/export-config")
def get_export_config():
    return {
        "cover_artwork_enabled": (
            settings.export_cover_artwork_enabled
        )
    }
