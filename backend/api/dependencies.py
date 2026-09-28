from fastapi import Depends
from sqlalchemy.orm import Session
from api.current_user import get_current_user
from bgg.client import BGGClient
from database.connection import get_db
from database.models import User
from repositories.game_repository import GameRepository
from repositories.insights_repository import InsightsRepository
from repositories.play_repository import PlayRepository
from repositories.picker_analytics_repository import (
    PickerAnalyticsRepository,
)
from repositories.ranking_repository import (
    RankingRepository,
)
from services.bgstats_play_import_service import (
    BGStatsPlayImportService,
)
from services.collection_service import CollectionService
from services.game_service import GameService
from services.insights_service import InsightsService
from services.play_service import PlayService
from services.live_timer_service import LiveTimerService
from repositories.live_timer_repository import LiveTimerRepository
from services.ranking_service import RankingService
from services.discover_service import (
    DiscoverService,
)
from services.discover_sources import (
    DiscoverCandidateProvider,
    HotDiscoverSource,
    RankedDiscoverSource,
)
from services.wishlist_service import WishlistService
from services.entitlements import Feature, can_use

def get_game_service(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
) -> GameService:
    repository = GameRepository(db)

    return GameService(
        repository,
        user_id=current_user.id,
    )


def get_collection_service(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
) -> CollectionService:
    return CollectionService(
        bgg_client=BGGClient(),
        repository=GameRepository(db),
        user_id=current_user.id,
    )


def get_play_repository(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
) -> PlayRepository:
    return PlayRepository(
        db,
        user_id=current_user.id,
    )


def get_play_service(
    repository: PlayRepository = Depends(
        get_play_repository
    ),
) -> PlayService:
    return PlayService(repository)


def get_live_timer_service(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LiveTimerService:
    return LiveTimerService(LiveTimerRepository(db, current_user.id))


def get_picker_analytics_repository(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
) -> PickerAnalyticsRepository:
    return PickerAnalyticsRepository(
        db,
        user_id=current_user.id,
    )


def get_ranking_repository(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
) -> RankingRepository:
    return RankingRepository(
        db,
        user_id=current_user.id,
    )


def get_ranking_service(
    repository: RankingRepository = Depends(
        get_ranking_repository
    ),
) -> RankingService:
    return RankingService(repository)


def get_picker_personal_rankings(
    current_user: User = Depends(
        get_current_user
    ),
    repository: RankingRepository = Depends(
        get_ranking_repository
    ),
) -> list[dict]:
    if not can_use(
        current_user,
        Feature.ADVANCED_RECOMMENDATIONS,
    ):
        return []

    return repository.get_compared_owned_games()


def get_insights_service(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    ),
) -> InsightsService:
    repository = InsightsRepository(
        db,
        user_id=current_user.id,
    )

    return InsightsService(repository)


def get_bgstats_play_import_service(
    repository: PlayRepository = Depends(
        get_play_repository
    ),
) -> BGStatsPlayImportService:
    return BGStatsPlayImportService(
        repository
    )

def get_discover_service(
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
    play_repository: PlayRepository = Depends(
        get_play_repository
    ),
    ranking_repository: RankingRepository = Depends(
        get_ranking_repository
    ),
) -> DiscoverService:
    bgg_client = BGGClient()

    return DiscoverService(
        repository=GameRepository(db),
        play_repository=play_repository,
        ranking_repository=ranking_repository,
        bgg_client=bgg_client,
        candidate_provider=(
            DiscoverCandidateProvider(
                sources=[
                    HotDiscoverSource(bgg_client),
                    RankedDiscoverSource(bgg_client),
                ]
            )
        ),
        user_id=current_user.id,
    )


def get_wishlist_service(
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
) -> WishlistService:
    return WishlistService(
        repository=GameRepository(db),
        bgg_client=BGGClient(),
        user_id=current_user.id,
    )
