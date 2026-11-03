from datetime import (
    datetime,
    timedelta,
    timezone,
)
from config import settings
import jwt
from pwdlib import PasswordHash

JWT_ALGORITHM = "HS256"
JWT_ISSUER = "boardgamepicker"

password_hash = (
    PasswordHash.recommended()
)


def hash_password(
    password: str,
) -> str:
    return password_hash.hash(
        password
    )


def verify_password(
    password: str,
    hashed_password: str,
) -> bool:
    return password_hash.verify(
        password,
        hashed_password,
    )


def create_access_token(
    user_id: int,
    token_version: int = 0,
) -> str:
    now = datetime.now(
        timezone.utc
    )

    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(
            minutes=settings.access_token_minutes
        ),
        "iss": JWT_ISSUER,
        "ver": token_version,
    }

    return jwt.encode(
        payload,
        settings.jwt_secret,
        algorithm=JWT_ALGORITHM,
    )


def decode_access_token(
    token: str,
) -> tuple[int, int]:
    payload = jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[
            JWT_ALGORITHM
        ],
        issuer=JWT_ISSUER,
    )

    subject = payload.get(
        "sub"
    )

    if subject is None:
        raise ValueError(
            "Token has no subject"
        )

    token_version = payload.get("ver", 0)
    if not isinstance(token_version, int):
        raise ValueError("Token version is invalid")

    return int(subject), token_version
