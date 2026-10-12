from datetime import (
    datetime,
    timedelta,
    timezone,
)

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import (
    sessionmaker,
)
from sqlalchemy.pool import StaticPool

from api.main import app
from auth.security import (
    JWT_ALGORITHM,
    JWT_ISSUER,
    create_access_token,
)
from config import settings

from database.connection import (
    Base,
    get_db,
)
from database.models import (
    AuthToken,
    Game,
    User,
    UserGame,
)
from api.dependencies import (
    get_collection_service,
)

from auth.login_rate_limiter import (
    login_rate_limiter,
    password_reset_request_rate_limiter,
    verification_request_rate_limiter,
)

engine = create_engine(
    "sqlite://",
    connect_args={
        "check_same_thread": False,
    },
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


@pytest.fixture(autouse=True)
def test_database():
    login_rate_limiter.clear()
    password_reset_request_rate_limiter.clear()
    verification_request_rate_limiter.clear()

    Base.metadata.create_all(
        bind=engine
    )

    yield

    Base.metadata.drop_all(
        bind=engine
    )

    login_rate_limiter.clear()
    password_reset_request_rate_limiter.clear()
    verification_request_rate_limiter.clear()


@pytest.fixture
def client():
    def override_get_db():
        db = TestingSessionLocal()

        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[
        get_db
    ] = override_get_db

    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def register_user(
    client: TestClient,
    email: str = "tom@example.com",
    display_name: str = "Tom",
    password: str = "password123",
):
    return client.post(
        "/auth/register",
        json={
            "email": email,
            "display_name": display_name,
            "password": password,
        },
    )


def capture_sent_emails(
    monkeypatch: pytest.MonkeyPatch,
):
    sent_emails = []

    def fake_send_email(
        to_email: str,
        subject: str,
        html: str,
    ):
        sent_emails.append(
            {
                "to_email": to_email,
                "subject": subject,
                "html": html,
            }
        )

    monkeypatch.setattr(
        "api.routers.auth.send_email",
        fake_send_email,
    )

    return sent_emails


def token_from_email(
    email: dict[str, str],
) -> str:
    return (
        email["html"]
        .split("token=", 1)[1]
        .split('"', 1)[0]
    )


def enable_private_beta(monkeypatch: pytest.MonkeyPatch, invited: set[str]):
    monkeypatch.setattr("api.routers.auth.private_beta_enabled", lambda: True)
    monkeypatch.setattr(
        "api.routers.auth.is_beta_invited",
        lambda email: email.strip().casefold() in invited,
    )


def test_private_beta_registration_is_invite_only_and_generic(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    sent_emails = capture_sent_emails(monkeypatch)
    enable_private_beta(monkeypatch, {"invited@example.com"})

    uninvited = register_user(client, email="outsider@example.com")
    invited = register_user(client, email="Invited@Example.com")
    duplicate = register_user(client, email="invited@example.com")

    assert uninvited.status_code == invited.status_code == duplicate.status_code == 201
    assert uninvited.json() == invited.json() == duplicate.json()
    assert len(sent_emails) == 1

    db = TestingSessionLocal()
    try:
        users = db.query(User).all()
        assert [user.email for user in users] == ["invited@example.com"]
        assert users[0].tier == "FREE"
    finally:
        db.close()


def test_beta_account_requires_valid_single_use_verification(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    sent_emails = capture_sent_emails(monkeypatch)
    enable_private_beta(monkeypatch, {"invited@example.com"})
    register_user(client, email="invited@example.com")

    blocked = client.post("/auth/login", json={
        "email": "invited@example.com", "password": "password123",
    })
    assert blocked.status_code == 403

    token = token_from_email(sent_emails[-1])
    confirmed = client.post("/auth/verification/confirm", json={"token": token})
    reused = client.post("/auth/verification/confirm", json={"token": token})
    login = client.post("/auth/login", json={
        "email": "invited@example.com", "password": "password123",
    })

    assert confirmed.status_code == 200
    assert reused.status_code == 400
    assert login.status_code == 200
    assert login.json()["user"]["tier"] == "FREE"


def test_expired_beta_verification_token_is_rejected(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    sent_emails = capture_sent_emails(monkeypatch)
    enable_private_beta(monkeypatch, {"invited@example.com"})
    register_user(client, email="invited@example.com")
    token = token_from_email(sent_emails[-1])

    db = TestingSessionLocal()
    try:
        auth_token = db.query(AuthToken).one()
        auth_token.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    finally:
        db.close()

    response = client.post("/auth/verification/confirm", json={"token": token})
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid or expired verification token"


def test_beta_verification_resend_is_generic_and_rate_limited(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    capture_sent_emails(monkeypatch)
    enable_private_beta(monkeypatch, {"invited@example.com"})
    register_user(client, email="invited@example.com")

    responses = []
    for _ in range(5):
        responses.append(client.post(
            "/auth/verification/resend", json={"email": "invited@example.com"},
        ))
    missing = client.post(
        "/auth/verification/resend", json={"email": "missing@example.com"},
    )
    blocked = client.post(
        "/auth/verification/resend", json={"email": "invited@example.com"},
    )

    assert all(response.status_code == 200 for response in responses)
    assert missing.status_code == 200
    assert missing.json() == responses[0].json()
    assert blocked.status_code == 429


def test_register_returns_token_and_user(
    client: TestClient,
):
    response = register_user(client)

    assert response.status_code == 201

    data = response.json()

    assert data["access_token"]
    assert data["token_type"] == "bearer"

    assert (
        data["user"]["email"]
        == "tom@example.com"
    )

    assert (
        data["user"]["display_name"]
        == "Tom"
    )

    assert (
        data["user"]["bgg_username"]
        is None
    )

    assert (
        data["user"]["email_verified"]
        is False
    )


def test_valid_verification_token_verifies_user_once(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    sent_emails = capture_sent_emails(
        monkeypatch
    )

    registration = register_user(client)
    access_token = registration.json()[
        "access_token"
    ]
    verification_token = token_from_email(
        sent_emails[-1]
    )

    response = client.post(
        "/auth/verification/confirm",
        json={
            "token": verification_token,
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "message": "Email verified"
    }

    me_response = client.get(
        "/auth/me",
        headers={
            "Authorization": (
                f"Bearer {access_token}"
            ),
        },
    )

    assert (
        me_response.json()[
            "email_verified"
        ]
        is True
    )

    reused = client.post(
        "/auth/verification/confirm",
        json={
            "token": verification_token,
        },
    )

    assert reused.status_code == 400


def test_invalid_verification_token_returns_400(
    client: TestClient,
):
    response = client.post(
        "/auth/verification/confirm",
        json={
            "token": "not-a-valid-token",
        },
    )

    assert response.status_code == 400


def test_password_reset_request_is_generic(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    capture_sent_emails(monkeypatch)
    register_user(client)

    existing = client.post(
        "/auth/password-reset/request",
        json={
            "email": "tom@example.com",
        },
    )
    missing = client.post(
        "/auth/password-reset/request",
        json={
            "email": "missing@example.com",
        },
    )

    assert existing.status_code == 200
    assert missing.status_code == 200
    assert existing.json() == missing.json()


def test_valid_password_reset_token_changes_password_once(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    sent_emails = capture_sent_emails(
        monkeypatch
    )
    register_user(client)

    request_response = client.post(
        "/auth/password-reset/request",
        json={
            "email": "tom@example.com",
        },
    )

    assert request_response.status_code == 200

    reset_token = token_from_email(
        sent_emails[-1]
    )

    response = client.post(
        "/auth/password-reset/confirm",
        json={
            "token": reset_token,
            "password": "new-password123",
        },
    )

    assert response.status_code == 200

    old_login = client.post(
        "/auth/login",
        json={
            "email": "tom@example.com",
            "password": "password123",
        },
    )
    new_login = client.post(
        "/auth/login",
        json={
            "email": "tom@example.com",
            "password": "new-password123",
        },
    )

    assert old_login.status_code == 401
    assert new_login.status_code == 200

    reused = client.post(
        "/auth/password-reset/confirm",
        json={
            "token": reset_token,
            "password": "another-password123",
        },
    )

    assert reused.status_code == 400


def test_invalid_password_reset_token_returns_400(
    client: TestClient,
):
    response = client.post(
        "/auth/password-reset/confirm",
        json={
            "token": "not-a-valid-token",
            "password": "new-password123",
        },
    )

    assert response.status_code == 400

def test_duplicate_registration_returns_409(
    client: TestClient,
):
    first = register_user(client)

    assert first.status_code == 201

    second = register_user(client)

    assert second.status_code == 409


def test_login_returns_token(
    client: TestClient,
):
    register_user(client)

    response = client.post(
        "/auth/login",
        json={
            "email": "tom@example.com",
            "password": "password123",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["access_token"]
    assert (
        data["user"]["email"]
        == "tom@example.com"
    )


def test_login_rejects_wrong_password(
    client: TestClient,
):
    register_user(client)

    response = client.post(
        "/auth/login",
        json={
            "email": "tom@example.com",
            "password": "wrong-password",
        },
    )

    assert response.status_code == 401


def test_me_returns_authenticated_user(
    client: TestClient,
):
    register_response = (
        register_user(client)
    )

    token = register_response.json()[
        "access_token"
    ]

    response = client.get(
        "/auth/me",
        headers={
            "Authorization":
                f"Bearer {token}",
        },
    )

    assert response.status_code == 200

    assert response.json()["email"] == (
        "tom@example.com"
    )


def test_me_requires_token(
    client: TestClient,
):
    response = client.get(
        "/auth/me"
    )

    assert response.status_code == 401


def test_me_rejects_invalid_token(
    client: TestClient,
):
    response = client.get(
        "/auth/me",
        headers={
            "Authorization":
                "Bearer definitely-not-valid",
        },
    )

    assert response.status_code == 401


def test_me_rejects_expired_token(
    client: TestClient,
):
    now = datetime.now(
        timezone.utc
    )

    token = jwt.encode(
        {
            "sub": "1",
            "iat": now
            - timedelta(hours=2),
            "exp": now
            - timedelta(hours=1),
            "iss": JWT_ISSUER,
        },
        settings.jwt_secret,
        algorithm=JWT_ALGORITHM,
    )

    response = client.get(
        "/auth/me",
        headers={
            "Authorization":
                f"Bearer {token}",
        },
    )

    assert response.status_code == 401


def test_protected_endpoint_requires_auth(
    client: TestClient,
):
    response = client.get(
        "/games"
    )

    assert response.status_code == 401


def test_users_only_see_their_own_collection(
    client: TestClient,
):
    first = register_user(
        client,
        email="tom@example.com",
        display_name="Tom",
    )

    second = register_user(
        client,
        email="other@example.com",
        display_name="Other",
    )

    first_token = first.json()[
        "access_token"
    ]

    second_token = second.json()[
        "access_token"
    ]

    db = TestingSessionLocal()

    try:
        first_user = (
            db.query(User)
            .filter(
                User.email
                == "tom@example.com"
            )
            .one()
        )

        second_user = (
            db.query(User)
            .filter(
                User.email
                == "other@example.com"
            )
            .one()
        )

        first_game = Game(
            bgg_id=1001,
            name="Tom's Game",
            owned=False,
        )

        second_game = Game(
            bgg_id=1002,
            name="Other Game",
            owned=False,
        )

        db.add_all(
            [
                first_game,
                second_game,
            ]
        )

        db.flush()

        db.add_all(
            [
                UserGame(
                    user_id=first_user.id,
                    game_id=first_game.id,
                ),
                UserGame(
                    user_id=second_user.id,
                    game_id=second_game.id,
                ),
            ]
        )

        db.commit()

    finally:
        db.close()

    first_response = client.get(
        "/games",
        headers={
            "Authorization":
                f"Bearer {first_token}",
        },
    )

    second_response = client.get(
        "/games",
        headers={
            "Authorization":
                f"Bearer {second_token}",
        },
    )

    assert (
        first_response.status_code
        == 200
    )

    assert (
        second_response.status_code
        == 200
    )

    first_ids = {
        game["bgg_id"]
        for game
        in first_response.json()
    }

    second_ids = {
        game["bgg_id"]
        for game
        in second_response.json()
    }

    assert first_ids == {1001}
    assert second_ids == {1002}

def test_authenticated_user_can_sync_collection(
    client: TestClient,
):
    register_response = (
        register_user(client)
    )

    token = register_response.json()[
        "access_token"
    ]

    class FakeCollectionService:
        def sync_collection(
            self,
            username: str,
        ):
            return [
                Game(
                    bgg_id=174430,
                    name="Gloomhaven",
                ),
                Game(
                    bgg_id=167791,
                    name="Terraforming Mars",
                ),
            ]

    app.dependency_overrides[
        get_collection_service
    ] = (
        lambda:
            FakeCollectionService()
    )

    try:
        response = client.post(
            "/collection/sync",
            headers={
                "Authorization":
                    f"Bearer {token}",
            },
            json={
                "username": "tom",
            },
        )

        assert (
            response.status_code
            == 200
        )

        assert response.json() == {
            "username": "tom",
            "games_synced": 2,
        }

        me_response = client.get(
            "/auth/me",
            headers={
                "Authorization":
                    f"Bearer {token}",
            },
        )

        assert (
            me_response.status_code
            == 200
        )

        assert (
            me_response.json()[
                "bgg_username"
            ]
            == "tom"
        )

    finally:
        app.dependency_overrides.pop(
            get_collection_service,
            None,
        )

def test_login_rate_limits_failed_attempts(
    client: TestClient,
):
    register_user(
        client
    )

    for _ in range(5):
        response = client.post(
            "/auth/login",
            json={
                "email":
                    "tom@example.com",
                "password":
                    "wrong-password",
            },
        )

        assert (
            response.status_code
            == 401
        )

    blocked = client.post(
        "/auth/login",
        json={
            "email":
                "tom@example.com",
            "password":
                "wrong-password",
        },
    )

    assert (
        blocked.status_code
        == 429
    )

    assert (
        blocked.json()["detail"]
        == (
            "Too many failed login "
            "attempts. Please try "
            "again later."
        )
    )

    assert (
        blocked.headers[
            "retry-after"
        ]
        == "900"
    )


def test_verification_requests_are_rate_limited(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    capture_sent_emails(monkeypatch)
    registration = register_user(client)
    access_token = registration.json()[
        "access_token"
    ]
    headers = {
        "Authorization": (
            f"Bearer {access_token}"
        ),
    }

    for _ in range(5):
        response = client.post(
            "/auth/verification/request",
            headers=headers,
        )

        assert response.status_code == 200

    blocked = client.post(
        "/auth/verification/request",
        headers=headers,
    )

    assert blocked.status_code == 429
    assert blocked.headers[
        "retry-after"
    ] == "900"


def test_password_reset_requests_are_rate_limited(
    client: TestClient,
):
    for _ in range(5):
        response = client.post(
            "/auth/password-reset/request",
            json={
                "email": (
                    "missing@example.com"
                ),
            },
        )

        assert response.status_code == 200

    blocked = client.post(
        "/auth/password-reset/request",
        json={
            "email": "missing@example.com",
        },
    )

    assert blocked.status_code == 429
    assert blocked.headers[
        "retry-after"
    ] == "900"


def test_successful_login_resets_rate_limit(
    client: TestClient,
):
    register_user(
        client
    )

    for _ in range(4):
        response = client.post(
            "/auth/login",
            json={
                "email":
                    "tom@example.com",
                "password":
                    "wrong-password",
            },
        )

        assert (
            response.status_code
            == 401
        )

    success = client.post(
        "/auth/login",
        json={
            "email":
                "tom@example.com",
            "password":
                "password123",
        },
    )

    assert (
        success.status_code
        == 200
    )

    after_success = client.post(
        "/auth/login",
        json={
            "email":
                "tom@example.com",
            "password":
                "wrong-password",
        },
    )

    assert (
        after_success.status_code
        == 401
    )
