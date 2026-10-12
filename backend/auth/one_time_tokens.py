import hashlib
import secrets
from datetime import (
    datetime,
    timedelta,
    timezone,
)

from sqlalchemy.orm import Session

from database.models import (
    AuthToken,
)


EMAIL_VERIFY = "email_verify"
BETA_EMAIL_VERIFY = "beta_email_verify"
PASSWORD_RESET = "password_reset"

EMAIL_VERIFY_HOURS = 24
PASSWORD_RESET_MINUTES = 30


def hash_token(
    token: str,
) -> str:
    return hashlib.sha256(
        token.encode("utf-8")
    ).hexdigest()


def create_one_time_token(
    db: Session,
    user_id: int,
    purpose: str,
) -> str:
    if purpose in {EMAIL_VERIFY, BETA_EMAIL_VERIFY}:
        lifetime = timedelta(
            hours=EMAIL_VERIFY_HOURS
        )

    elif purpose == PASSWORD_RESET:
        lifetime = timedelta(
            minutes=PASSWORD_RESET_MINUTES
        )

    else:
        raise ValueError(
            "Unsupported token purpose"
        )

    raw_token = secrets.token_urlsafe(
        32
    )

    db.query(AuthToken).filter(
        AuthToken.user_id == user_id,
        AuthToken.purpose == purpose,
        AuthToken.used_at.is_(None),
    ).delete(
        synchronize_session=False
    )

    db.add(
        AuthToken(
            user_id=user_id,
            token_hash=hash_token(
                raw_token
            ),
            purpose=purpose,
            expires_at=(
                datetime.now(
                    timezone.utc
                )
                + lifetime
            ),
        )
    )

    db.commit()

    return raw_token


def consume_one_time_token(
    db: Session,
    raw_token: str,
    purpose: str,
) -> AuthToken | None:
    now = datetime.now(
        timezone.utc
    )

    token = (
        db.query(AuthToken)
        .filter(
            AuthToken.token_hash
            == hash_token(raw_token),
            AuthToken.purpose
            == purpose,
            AuthToken.used_at.is_(None),
            AuthToken.expires_at > now,
        )
        .first()
    )

    if token is None:
        return None

    token.used_at = now

    db.commit()
    db.refresh(token)

    return token
