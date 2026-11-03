from fastapi import (
    Depends,
    HTTPException,
    status,
)
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from jwt import (
    ExpiredSignatureError,
    InvalidTokenError,
)
from sqlalchemy.orm import Session

from auth.security import (
    decode_access_token,
)
from database.connection import get_db
from database.models import User


bearer_scheme = HTTPBearer(
    auto_error=False,
)


def get_current_user(
    credentials:
        HTTPAuthorizationCredentials
        | None = Depends(
            bearer_scheme
        ),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail="Authentication required",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    try:
        user_id, token_version = decode_access_token(
            credentials.credentials
        )

    except ExpiredSignatureError:
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail="Token has expired",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    except (
        InvalidTokenError,
        ValueError,
    ):
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail="Invalid token",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    user = (
        db.query(User)
        .filter(
            User.id == user_id
        )
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=(
                status.HTTP_401_UNAUTHORIZED
            ),
            detail="User not found",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    if user.token_version != token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.email_verified_at is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verify your email before signing in.",
        )

    return user
