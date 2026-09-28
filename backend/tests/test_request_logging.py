from fastapi.testclient import (
    TestClient,
)

from api.main import app
from middleware.request_logging import safe_request_path


client = TestClient(app)


def test_game_night_join_tokens_are_redacted_from_request_paths():
    assert safe_request_path(
        "/game-night/voting/secret-token/ballot"
    ) == "/game-night/voting/[join-token]/ballot"
    assert safe_request_path(
        "/game-night/voting/sessions/host-session"
    ) == "/game-night/voting/sessions/host-session"


def test_response_contains_request_id():
    response = client.get(
        "/health"
    )

    assert (
        response.status_code
        == 200
    )

    assert (
        response.headers.get(
            "X-Request-ID"
        )
        is not None
    )


def test_existing_request_id_is_preserved():
    request_id = (
        "test-request-123"
    )

    response = client.get(
        "/health",
        headers={
            "X-Request-ID":
                request_id,
        },
    )

    assert (
        response.status_code
        == 200
    )

    assert (
        response.headers[
            "X-Request-ID"
        ]
        == request_id
    )
