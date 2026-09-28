from fastapi import FastAPI
from fastapi.middleware.cors import (
    CORSMiddleware,
)
from config import settings
from api.dependencies import (
    get_collection_service,
    get_game_service,
    get_picker_analytics_repository,
    get_play_repository,
    get_play_service,
)

from api.routers import (
    auth,
    collection,
    discover,
    games,
    game_night,
    health,
    imports,
    insights,
    picker,
    plays,
    rankings,
    wishlist,
)

from logging_config import (
    configure_logging,
)
from middleware.request_logging import (
    RequestLoggingMiddleware,
)

# Backwards-compatible name used by the
# existing API tests.
get_picker_play_repository = (
    get_play_repository
)

configure_logging()

app = FastAPI(
    title="ShelfPick API",
    version="0.1.0",
)


app.add_middleware(
    RequestLoggingMiddleware
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=(
        settings.cors_origins
    ),
    allow_credentials=False,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
    "Authorization",
    "Content-Type",
    "X-Game-Night-Guest",
    "X-Request-ID",
    ],
    expose_headers=[
        "X-Request-ID",
        "X-ShelfPick-Personalisation",
        "X-ShelfPick-Personalisation-Signals",
    ],
    )

app.include_router(
    health.router
)

app.include_router(
    games.router
)

app.include_router(
    collection.router
)

app.include_router(
    picker.router
)

app.include_router(
    game_night.router
)

app.include_router(
    plays.router
)

app.include_router(
    rankings.router
)

app.include_router(
    insights.router
)

app.include_router(
    imports.router
)

app.include_router(
    auth.router
)

app.include_router(
    discover.router
)

app.include_router(
    wishlist.router
)
