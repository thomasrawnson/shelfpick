import logging
from config import settings
from email_service import send_email
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    status,
)
from sqlalchemy.orm import Session

from api.current_user import (
    get_current_user,
)
from auth.schemas import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    UserResponse,
    ProfileUpdateRequest,
    EmailRequest,
    MessageResponse,
    ResetPasswordRequest,
    TokenRequest,
)
from auth.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from database.connection import get_db
from database.models import User
from services.profile_service import update_profile
from services.entitlements import entitlements_for, resolve_tier
from auth.login_rate_limiter import (
    AUTH_REQUEST_WINDOW_SECONDS,
    LOGIN_WINDOW_SECONDS,
    login_rate_limiter,
    password_reset_request_rate_limiter,
    verification_request_rate_limiter,
)
from datetime import (
    datetime,
    timezone,
)
from auth.one_time_tokens import (
    EMAIL_VERIFY,
    PASSWORD_RESET,
    consume_one_time_token,
    create_one_time_token,
)

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)

logger = logging.getLogger(
    "boardgamepicker.auth"
)


def verification_email_html(
    token: str,
) -> str:
    url = (
        f"{settings.frontend_url}"
        f"/verify-email?token={token}"
    )

    return f"""
    <h2>Verify your ShelfPick email</h2>
    <p>
        Thanks for creating an account.
    </p>
    <p>
        <a href="{url}">
            Verify my email
        </a>
    </p>
    <p>
        This link expires in 24 hours.
    </p>
    """


def password_reset_email_html(
    token: str,
) -> str:
    url = (
        f"{settings.frontend_url}"
        f"/reset-password?token={token}"
    )

    return f"""
    <h2>Reset your ShelfPick password</h2>
    <p>
        We received a request to reset
        your password.
    </p>
    <p>
        <a href="{url}">
            Reset my password
        </a>
    </p>
    <p>
        This link expires in 30 minutes.
    </p>
    <p>
        If you did not request this,
        you can ignore this email.
    </p>
    """

def login_rate_limit_key(
    request: Request,
    email: str,
) -> str:
    forwarded_for = (
        request.headers.get(
            "x-forwarded-for"
        )
    )

    if forwarded_for:
        client_ip = (
            forwarded_for
            .split(",")[0]
            .strip()
        )
    elif request.client:
        client_ip = (
            request.client.host
        )
    else:
        client_ip = "unknown"

    return (
        f"{client_ip}:"
        f"{email}"
    )

def user_response(
    user: User,
) -> UserResponse:
    player = user.profile_player
    return UserResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        bgg_username=user.bgg_username,
        email_verified=(
            user.email_verified_at
            is not None
        ),
        tier=resolve_tier(user).value,
        entitlements=[feature.value for feature in entitlements_for(user)],
        onboarding_completed=user.onboarding_completed,
        preferred_player_count=user.preferred_player_count,
        preferred_play_time=user.preferred_play_time,
        preferred_play_style=user.preferred_play_style,
        profile_player_id=user.profile_player_id,
        player_name=(
            player.name if player
            else (user.display_name or user.email.split("@", 1)[0])
        ),
        avatar_key=player.avatar_key if player else "forest",
    )


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=201,
)
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
):
    email = (
        request.email
        .strip()
        .lower()
    )

    existing = (
        db.query(User)
        .filter(
            User.email == email
        )
        .first()
    )

    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                "An account with this "
                "email already exists"
            ),
        )

    user = User(
        email=email,
        display_name=(
            request.display_name.strip()
        ),
        password_hash=hash_password(
            request.password
        ),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    verification_token = (
        create_one_time_token(
            db,
            user.id,
            EMAIL_VERIFY,
        )
    )

    try:
        send_email(
            to_email=user.email,
            subject=(
                "Verify your "
                "ShelfPick email"
            ),
            html=(
                verification_email_html(
                    verification_token
                )
            ),
        )
    except Exception:
        logger.exception(
            "verification_email_failed "
            "user_id=%s",
            user.id,
        )
    token = create_access_token(
        user.id
    )

    return AuthResponse(
        access_token=token,
        user=user_response(user),
    )


@router.post(
    "/login",
    response_model=AuthResponse,
)
def login(
    request: Request,
    credentials: LoginRequest,
    db: Session = Depends(get_db),
):
    email = (
        credentials.email
        .strip()
        .lower()
    )

    rate_limit_key = (
        login_rate_limit_key(
            request,
            email,
        )
    )

    if (
        login_rate_limiter
        .is_limited(
            rate_limit_key
        )
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_429_TOO_MANY_REQUESTS
            ),
            detail=(
                "Too many failed login "
                "attempts. Please try "
                "again later."
            ),
            headers={
                "Retry-After": str(
                    LOGIN_WINDOW_SECONDS
                ),
            },
        )

    user = (
        db.query(User)
        .filter(
            User.email == email
        )
        .first()
    )

    if (
        user is None
        or user.password_hash
        is None
        or not verify_password(
            credentials.password,
            user.password_hash,
        )
    ):
        login_rate_limiter.record_failure(
            rate_limit_key
        )

        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Invalid email or password"
            ),
        )

    login_rate_limiter.reset(
        rate_limit_key
    )

    token = create_access_token(
        user.id
    )

    return AuthResponse(
        access_token=token,
        user=user_response(user),
    )

@router.post(
    "/onboarding/complete",
    response_model=UserResponse,
)
def complete_onboarding(
    changes: ProfileUpdateRequest = ProfileUpdateRequest(),
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    try:
        user = update_profile(db, current_user, changes, complete_onboarding=True)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return user_response(user)


@router.put("/profile", response_model=UserResponse)
def save_profile(
    changes: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        user = update_profile(db, current_user, changes)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return user_response(user)

@router.post(
    "/verification/request",
    response_model=MessageResponse,
)
def request_verification(
    request: Request,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    rate_limit_key = (
        login_rate_limit_key(
            request,
            str(current_user.id),
        )
    )

    if (
        verification_request_rate_limiter
        .is_limited(rate_limit_key)
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_429_TOO_MANY_REQUESTS
            ),
            detail=(
                "Too many verification "
                "requests. Please try "
                "again later."
            ),
            headers={
                "Retry-After": str(
                    AUTH_REQUEST_WINDOW_SECONDS
                ),
            },
        )

    verification_request_rate_limiter.record_request(
        rate_limit_key
    )

    if (
        current_user.email_verified_at
        is not None
    ):
        return MessageResponse(
            message=(
                "Email is already verified"
            )
        )

    token = create_one_time_token(
        db,
        current_user.id,
        EMAIL_VERIFY,
    )

    try:
        send_email(
            to_email=current_user.email,
            subject=(
                "Verify your "
                "ShelfPick email"
            ),
            html=(
                verification_email_html(
                    token
                )
            ),
        )
    except Exception:
        logger.exception(
            "verification_email_failed "
            "user_id=%s",
            current_user.id,
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "Unable to send "
                "verification email "
                "right now"
            ),
        )

    return MessageResponse(
        message=(
            "Verification email sent"
        )
    )


@router.post(
    "/verification/confirm",
    response_model=MessageResponse,
)
def confirm_verification(
    request: TokenRequest,
    db: Session = Depends(get_db),
):
    token = consume_one_time_token(
        db,
        request.token,
        EMAIL_VERIFY,
    )

    if token is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid or expired "
                "verification token"
            ),
        )

    user = db.get(
        User,
        token.user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid token",
        )

    user.email_verified_at = (
        datetime.now(
            timezone.utc
        )
    )

    db.commit()

    return MessageResponse(
        message="Email verified"
    )


@router.post(
    "/password-reset/request",
    response_model=MessageResponse,
)
def request_password_reset(
    request: EmailRequest,
    http_request: Request,
    db: Session = Depends(get_db),
):
    email = (
        request.email
        .strip()
        .lower()
    )

    rate_limit_key = (
        login_rate_limit_key(
            http_request,
            email,
        )
    )

    if (
        password_reset_request_rate_limiter
        .is_limited(rate_limit_key)
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_429_TOO_MANY_REQUESTS
            ),
            detail=(
                "Too many password reset "
                "requests. Please try "
                "again later."
            ),
            headers={
                "Retry-After": str(
                    AUTH_REQUEST_WINDOW_SECONDS
                ),
            },
        )

    password_reset_request_rate_limiter.record_request(
        rate_limit_key
    )

    user = (
        db.query(User)
        .filter(
            User.email == email
        )
        .first()
    )

    if user is not None:
        reset_token = (
            create_one_time_token(
                db,
                user.id,
                PASSWORD_RESET,
            )
        )

        try:
            send_email(
                to_email=user.email,
                subject=(
                    "Reset your "
                    "ShelfPick "
                    "password"
                ),
                html=(
                    password_reset_email_html(
                        reset_token
                    )
                ),
            )
        except Exception:
            logger.exception(
                "password_reset_email_failed "
                "user_id=%s",
                user.id,
            )

    # Deliberately identical response
    # whether the account exists or not.
    return MessageResponse(
        message=(
            "If an account exists for "
            "that email, reset "
            "instructions will be sent."
        )
    )


@router.post(
    "/password-reset/confirm",
    response_model=MessageResponse,
)
def confirm_password_reset(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    token = consume_one_time_token(
        db,
        request.token,
        PASSWORD_RESET,
    )

    if token is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid or expired "
                "password reset token"
            ),
        )

    user = db.get(
        User,
        token.user_id,
    )

    if user is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid token",
        )

    user.password_hash = (
        hash_password(
            request.password
        )
    )

    db.commit()

    return MessageResponse(
        message=(
            "Password updated"
        )
    )

@router.get(
    "/me",
    response_model=UserResponse,
)
def me(
    current_user: User = Depends(
        get_current_user
    ),
):
    return user_response(
        current_user
    )
