from hashlib import sha256

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field

from api.current_user import get_current_user
from api.dependencies import (
    get_game_night_voting_repository,
    get_game_service,
    get_play_repository,
)
from auth.login_rate_limiter import game_night_join_rate_limiter
from config import settings
from database.models import User
from repositories.game_night_voting_repository import GameNightVotingRepository
from repositories.play_repository import PlayRepository
from services.entitlements import Feature, can_use
from services.game_night_service import GameNightService
from services.game_night_voting_service import (
    GameNightVotingService,
    VotingClosedError,
    VotingExpiredError,
    VotingNotFoundError,
)
from services.game_service import GameService


router = APIRouter(prefix="/game-night", tags=["game-night"])


class OpenVotingRequest(BaseModel):
    candidate_bgg_ids: list[int] = Field(min_length=3, max_length=5)


class JoinVotingRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=40)


class BallotRequest(BaseModel):
    candidate_bgg_id: int | None = Field(default=None, gt=0)


def _require_enhanced(current_user: User) -> None:
    if not can_use(current_user, Feature.GAME_NIGHT_ENHANCED):
        raise HTTPException(
            status_code=403,
            detail="Phone voting requires ShelfPick Pro.",
        )


def _voting_error(error: ValueError) -> HTTPException:
    if isinstance(error, VotingNotFoundError):
        return HTTPException(status_code=404, detail=str(error))
    if isinstance(error, VotingExpiredError):
        return HTTPException(status_code=410, detail=str(error))
    if isinstance(error, VotingClosedError):
        return HTTPException(status_code=409, detail=str(error))
    return HTTPException(status_code=400, detail=str(error))


@router.get("/recommendations")
def get_game_night_recommendations(
    player_ids: list[int] = Query(..., min_length=1),
    max_play_time: int | None = Query(None, ge=1),
    limit: int = Query(5, ge=3, le=5),
    current_user: User = Depends(get_current_user),
    game_service: GameService = Depends(get_game_service),
    play_repository: PlayRepository = Depends(get_play_repository),
):
    if not can_use(current_user, Feature.GAME_NIGHT_BASIC):
        raise HTTPException(status_code=403, detail="Game Night is unavailable.")

    if len(player_ids) != len(set(player_ids)):
        raise HTTPException(status_code=400, detail="Player IDs must be unique.")

    known_player_ids = {
        player["id"] for player in play_repository.get_players()
    }
    if any(player_id not in known_player_ids for player_id in player_ids):
        raise HTTPException(status_code=400, detail="Unknown player.")

    matches = GameNightService().recommend(
        game_service.get_games(),
        player_ids,
        max_play_time,
        play_stats=play_repository.get_game_play_stats(),
        group_play_stats=play_repository.get_group_game_play_stats(player_ids),
        limit=limit,
    )

    return [
        {
            "game": match.game,
            "score": match.score,
            "reasons": [*match.reasons, "From your collection"],
        }
        for match in matches
    ]


@router.post("/voting", status_code=201)
def open_game_night_voting(
    payload: OpenVotingRequest,
    current_user: User = Depends(get_current_user),
    game_service: GameService = Depends(get_game_service),
    repository: GameNightVotingRepository = Depends(
        get_game_night_voting_repository
    ),
):
    _require_enhanced(current_user)
    try:
        return GameNightVotingService(repository).open_session(
            current_user.id,
            payload.candidate_bgg_ids,
            game_service.get_games(),
            settings.frontend_url,
        )
    except ValueError as error:
        raise _voting_error(error) from error


@router.get("/voting/sessions/{session_id}")
def get_game_night_voting_host_state(
    session_id: str,
    current_user: User = Depends(get_current_user),
    repository: GameNightVotingRepository = Depends(
        get_game_night_voting_repository
    ),
):
    _require_enhanced(current_user)
    try:
        return GameNightVotingService(repository).host_session(
            session_id, current_user.id,
        )
    except ValueError as error:
        raise _voting_error(error) from error


@router.post("/voting/sessions/{session_id}/close")
def close_game_night_voting(
    session_id: str,
    current_user: User = Depends(get_current_user),
    repository: GameNightVotingRepository = Depends(
        get_game_night_voting_repository
    ),
):
    _require_enhanced(current_user)
    try:
        return GameNightVotingService(repository).close(
            session_id, current_user.id,
        )
    except ValueError as error:
        raise _voting_error(error) from error


@router.get("/voting/{join_token}")
def get_game_night_voting_guest_state(
    join_token: str,
    guest_credential: str | None = Header(
        default=None, alias="X-Game-Night-Guest",
    ),
    repository: GameNightVotingRepository = Depends(
        get_game_night_voting_repository
    ),
):
    try:
        return GameNightVotingService(repository).public_session(
            join_token, guest_credential,
        )
    except ValueError as error:
        raise _voting_error(error) from error


@router.post("/voting/{join_token}/join")
def join_game_night_voting(
    join_token: str,
    payload: JoinVotingRequest,
    request: Request,
    repository: GameNightVotingRepository = Depends(
        get_game_night_voting_repository
    ),
):
    client = request.client.host if request.client else "unknown"
    limiter_key = (
        f"{client}:"
        f"{sha256(join_token.encode('utf-8')).hexdigest()[:16]}"
    )
    if game_night_join_rate_limiter.is_limited(limiter_key):
        raise HTTPException(
            status_code=429,
            detail="Too many join attempts. Try again later.",
        )
    game_night_join_rate_limiter.record_request(limiter_key)

    try:
        state, credential = GameNightVotingService(repository).join(
            join_token, payload.display_name,
        )
        return {**state, "guest_credential": credential}
    except ValueError as error:
        raise _voting_error(error) from error


@router.put("/voting/{join_token}/ballot")
def submit_game_night_ballot(
    join_token: str,
    payload: BallotRequest,
    guest_credential: str | None = Header(
        default=None, alias="X-Game-Night-Guest",
    ),
    repository: GameNightVotingRepository = Depends(
        get_game_night_voting_repository
    ),
):
    try:
        return GameNightVotingService(repository).vote(
            join_token,
            guest_credential,
            payload.candidate_bgg_id,
        )
    except ValueError as error:
        raise _voting_error(error) from error
