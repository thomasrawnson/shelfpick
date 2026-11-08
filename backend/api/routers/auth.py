import logging
import secrets
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
from api.client_address import trusted_client_address
from auth.schemas import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    RegistrationResponse,
    UserResponse,
    ProfileUpdateRequest,
    EmailRequest,
    MessageResponse,
    ResetPasswordRequest,
    TokenRequest,
    DeleteAccountRequest,
)
from auth.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from database.connection import get_db
from database.models import AuthToken, User
from services.profile_service import update_profile
from services.entitlements import entitlements_for, resolve_tier
from auth.login_rate_limiter import (
    AUTH_REQUEST_WINDOW_SECONDS,
    LOGIN_WINDOW_SECONDS,
    DatabaseAuthRateLimiter,
)
from datetime import (
    datetime,
    timezone,
)
from auth.one_time_tokens import (
    BETA_EMAIL_VERIFY,
    EMAIL_VERIFY,
    PASSWORD_RESET,
    consume_one_time_token,
    create_one_time_token,
)
from services.account_service import (
    AccountService,
    InvalidAccountPasswordError,
)

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)

logger = logging.getLogger(
    "boardgamepicker.auth"
)

BETA_REGISTRATION_MESSAGE = (
    "If this address is invited, check your email to activate your account."
)
PUBLIC_REGISTRATION_MESSAGE = (
    "If registration can continue for this address, check your email to verify your account."
)


def normalize_email(value: str) -> str:
    return value.strip().casefold()


def private_beta_enabled() -> bool:
    return not settings.public_registration_enabled


def is_beta_invited(email: str) -> bool:
    return normalize_email(email) in settings.beta_invite_emails


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

def enforce_auth_limit(
    db: Session,
    request: Request,
    scope: str,
    email: str,
    email_limit: int,
    ip_limit: int,
    window_seconds: int = AUTH_REQUEST_WINDOW_SECONDS,
    detail: str = "Too many requests. Please try again later.",
) -> None:
    limiter = DatabaseAuthRateLimiter(db)
    address = trusted_client_address(request)
    if limiter.check_and_record(
        f"{scope}:ip",
        address,
        ip_limit,
        window_seconds,
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            headers={"Retry-After": str(window_seconds)},
        )
    if limiter.check_and_record(
        f"{scope}:email",
        email,
        email_limit,
        window_seconds,
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            headers={"Retry-After": str(window_seconds)},
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
    response_model=AuthResponse | RegistrationResponse,
    status_code=201,
)
def register(
    request: RegisterRequest,
    http_request: Request,
    db: Session = Depends(get_db),
):
    email = normalize_email(str(request.email))

    enforce_auth_limit(
        db, http_request, "register", email,
        email_limit=3, ip_limit=10,
    )

    private_beta = private_beta_enabled()
    invited = not private_beta or is_beta_invited(email)

    existing = (
        db.query(User)
        .filter(
            User.email == email
        )
        .first()
    )

    if existing is not None:
        # Keep the public path materially similar for existing and new
        # addresses. Account owners receive the same verification-shaped
        # message; verified accounts get a deliberately invalid link.
        hash_password(request.password)
        verification_token = (
            create_one_time_token(
                db,
                existing.id,
                BETA_EMAIL_VERIFY if private_beta else EMAIL_VERIFY,
            )
            if invited and existing.email_verified_at is None
            else secrets.token_urlsafe(32)
        )
        try:
            send_email(
                to_email=email,
                subject="Verify your ShelfPick email",
                html=verification_email_html(verification_token),
            )
        except Exception:
            logger.exception(
                "verification_email_failed user_id=%s",
                existing.id,
            )
        return RegistrationResponse(
            message=(
                BETA_REGISTRATION_MESSAGE
                if private_beta_enabled()
                else PUBLIC_REGISTRATION_MESSAGE
            )
        )

    if not invited:
        hash_password(request.password)
        try:
            send_email(
                to_email=email,
                subject="Verify your ShelfPick email",
                html=verification_email_html(secrets.token_urlsafe(32)),
            )
        except Exception:
            logger.exception("verification_email_failed user_id=unknown")
        return RegistrationResponse(message=BETA_REGISTRATION_MESSAGE)

    user = User(
        email=email,
        display_name=(
            request.display_name.strip()
        ),
        password_hash=hash_password(
            request.password
        ),
        tier="FREE",
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    verification_token = (
        create_one_time_token(
            db,
            user.id,
            BETA_EMAIL_VERIFY if private_beta else EMAIL_VERIFY,
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
    return RegistrationResponse(
        message=(
            BETA_REGISTRATION_MESSAGE
                if private_beta
            else PUBLIC_REGISTRATION_MESSAGE
        )
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

    enforce_auth_limit(
        db, request, "login", email,
        email_limit=5, ip_limit=50,
        window_seconds=LOGIN_WINDOW_SECONDS,
        detail=(
            "Too many failed login attempts. "
            "Please try again later."
        ),
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
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail=(
                "Invalid email or password"
            ),
        )

    if user.email_verified_at is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verify your email before signing in.",
        )

    DatabaseAuthRateLimiter(db).reset(
        "login:email", email
    )

    token = create_access_token(
        user.id,
        user.token_version,
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
    enforce_auth_limit(
        db, request, "verification", current_user.email,
        email_limit=5, ip_limit=10,
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
    "/verification/resend",
    response_model=MessageResponse,
)
def resend_beta_verification(
    request: EmailRequest,
    http_request: Request,
    db: Session = Depends(get_db),
):
    email = normalize_email(str(request.email))
    enforce_auth_limit(
        db, http_request, "verification", email,
        email_limit=5, ip_limit=10,
    )
    generic = MessageResponse(
        message=(
            BETA_REGISTRATION_MESSAGE
            if private_beta_enabled()
            else PUBLIC_REGISTRATION_MESSAGE
        )
    )
    private_beta = private_beta_enabled()
    user = db.query(User).filter(User.email == email).first()
    purpose = BETA_EMAIL_VERIFY if private_beta else EMAIL_VERIFY
    pending_account = (
        db.query(AuthToken.id).filter(
            AuthToken.user_id == user.id,
            AuthToken.purpose == purpose,
        ).first()
        if user is not None
        else None
    )
    can_issue = (
        user is not None
        and user.email_verified_at is None
        and (not private_beta or is_beta_invited(email))
        and pending_account is not None
    )
    token = (
        create_one_time_token(db, user.id, purpose)
        if can_issue
        else secrets.token_urlsafe(32)
    )
    try:
        send_email(
            to_email=email,
            subject="Verify your ShelfPick email",
            html=verification_email_html(token),
        )
    except Exception:
        logger.exception(
            "verification_email_failed user_id=%s",
            user.id if user is not None else "unknown",
        )

    return generic


@router.post(
    "/verification/confirm",
    response_model=MessageResponse,
)
def confirm_verification(
    request: TokenRequest,
    db: Session = Depends(get_db),
):
    token = consume_one_time_token(
        db, request.token, BETA_EMAIL_VERIFY, commit=False
    )
    beta_token = token is not None

    if token is None:
        token = consume_one_time_token(
            db, request.token, EMAIL_VERIFY, commit=False
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

    if beta_token and not is_beta_invited(user.email):
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired verification token",
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

    enforce_auth_limit(
        db, http_request, "password-reset", email,
        email_limit=5, ip_limit=10,
    )

    user = (
        db.query(User)
        .filter(
            User.email == email
        )
        .first()
    )

    reset_token = secrets.token_urlsafe(32)
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
            to_email=email,
            subject="Reset your ShelfPick password",
            html=password_reset_email_html(reset_token),
        )
    except Exception:
        logger.exception(
            "password_reset_email_failed",
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
        commit=False,
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
    user.token_version += 1

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


@router.post("/logout-all", response_model=MessageResponse)
def logout_all(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.token_version += 1
    db.commit()
    return MessageResponse(message="All sessions logged out")


@router.delete("/account", response_model=MessageResponse)
def delete_account(
    request: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        AccountService(db).delete_account(
            current_user, request.password
        )
    except InvalidAccountPasswordError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    return MessageResponse(message="Account deleted")
