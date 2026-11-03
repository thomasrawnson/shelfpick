import xml.etree.ElementTree as ET

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
)
import httpx
from api.dependencies import (
    get_collection_service,
    get_game_service,
    get_play_repository,
)
from repositories.play_repository import (
    PlayRepository,
)
from services.collection_service import (
    CollectionService,
)
from services.game_service import GameService
from sqlalchemy.orm import Session

from api.current_user import (
    get_current_user,
)
from api.schemas.collection import (
    CollectionSyncRequest,
)
from database.connection import get_db
from database.models import User
from services.workload_limits import (
    GlobalOperationGuard,
    OperationCapacityError,
    OperationCooldownError,
    OperationInProgressError,
    UserOperationGuard,
)

COLLECTION_SYNC_COOLDOWN_SECONDS = 5 * 60
COLLECTION_SYNC_LEASE_SECONDS = 2 * 60 * 60

router = APIRouter()


@router.post(
    "/collection/sync"
)
def sync_collection(
    request: CollectionSyncRequest,
    service: CollectionService = Depends(
        get_collection_service
    ),
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    username = (
        request.username
        .strip()
    )

    user_guard = UserOperationGuard(
        db,
        current_user.id,
        "collection-sync",
        COLLECTION_SYNC_COOLDOWN_SECONDS,
        COLLECTION_SYNC_LEASE_SECONDS,
    )
    global_guard = GlobalOperationGuard(
        db,
        current_user.id,
        "collection-sync",
        COLLECTION_SYNC_LEASE_SECONDS,
    )

    try:
        global_guard.acquire()
    except OperationCapacityError as exc:
        raise HTTPException(
            status_code=429,
            detail=str(exc),
            headers={"Retry-After": "30"},
        ) from exc

    try:
        user_guard.acquire()
    except (OperationCooldownError, OperationInProgressError) as exc:
        global_guard.release()
        raise HTTPException(
            status_code=429,
            detail=str(exc),
            headers={
                "Retry-After": str(COLLECTION_SYNC_COOLDOWN_SECONDS)
            },
        ) from exc

    try:
        try:
            games = service.sync_collection(username)

        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail=str(exc),
            ) from exc

        except httpx.TimeoutException as exc:
            raise HTTPException(
                status_code=504,
                detail=(
                    "BoardGameGeek took too long "
                    "to respond. Please try again."
                ),
            ) from exc

        except httpx.HTTPStatusError as exc:
            upstream_status = exc.response.status_code

            if upstream_status == 404:
                detail = (
                    "That BoardGameGeek account "
                    "couldn't be found."
                )
            elif upstream_status == 401:
                detail = (
                    "BoardGameGeek rejected the "
                    "request. Please try again later."
                )
            elif upstream_status == 429:
                detail = (
                    "BoardGameGeek is temporarily "
                    "rate limiting requests. "
                    "Please try again shortly."
                )
            else:
                detail = (
                    "BoardGameGeek couldn't be "
                    "reached. Please try again."
                )

            raise HTTPException(
                status_code=502,
                detail=detail,
            ) from exc

        except RuntimeError as exc:
            raise HTTPException(
                status_code=503,
                detail=(
                    "BoardGameGeek is temporarily "
                    "busy. Please try again shortly."
                ),
            ) from exc

        current_user.bgg_username = username
        db.commit()

        return {
            "username": username,
            "games_synced": len(games),
        }
    finally:
        user_guard.release()
        global_guard.release()


@router.get(
    "/collection/search"
)
def search_collection_games(
    query: str = Query(
        ...,
        min_length=2,
        max_length=100,
    ),
    service: CollectionService = Depends(
        get_collection_service
    ),
):
    try:
        return service.search_games(
            query
        )
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
    ) as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Couldn't search "
                "BoardGameGeek right now."
            ),
        ) from exc


@router.post(
    "/collection/games/{bgg_id}"
)
def add_collection_game(
    bgg_id: int,
    service: CollectionService = Depends(
        get_collection_service
    ),
):
    try:
        game = service.add_game(
            bgg_id
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
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
    ) as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Couldn't add that game "
                "from BoardGameGeek."
            ),
        ) from exc

    return game

@router.get("/collection/stats")
def get_collection_stats(
    repository: PlayRepository = Depends(
        get_play_repository
    ),
):
    return (
        repository.get_collection_stats()
    )


@router.delete(
    "/collection/{bgg_id}"
)
def remove_from_collection(
    bgg_id: int,
    service: GameService = Depends(
        get_game_service
    ),
):
    removed = (
        service.remove_from_collection(
            bgg_id
        )
    )

    if not removed:
        raise HTTPException(
            status_code=404,
            detail=(
                "Game not found in collection"
            ),
        )

    return {
        "message": (
            "Game removed from collection"
        )
    }
