import dataclasses

import httpx
import pytest
from fastapi.testclient import TestClient

from api.current_user import get_current_user
from api.main import app
from api.routers.export_cover import get_export_cover_service
from config import settings
from database.models import User
from services.export_cover_service import (
    MAX_COVER_BYTES,
    ExportCoverService,
    InvalidCoverURLError,
    validate_cover_url,
)


COVER_URL = "https://cf.geekdo-images.com/original/img/abc=/0x0/pic2437871.jpg"
JPEG = b"\xff\xd8\xff\xe0cover-bytes"


client = TestClient(app)


@pytest.fixture(autouse=True)
def signed_in():
    app.dependency_overrides[get_current_user] = lambda: User(
        id=1, email="free@example.com", tier="FREE"
    )
    yield
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_export_cover_service, None)


def serve(handler):
    seen = []

    def recording(request):
        seen.append(request)
        return handler(request)

    app.dependency_overrides[get_export_cover_service] = lambda: ExportCoverService(
        transport=httpx.MockTransport(recording)
    )
    return seen


def image_response(content=JPEG, content_type="image/jpeg", status=200):
    return lambda request: httpx.Response(
        status, content=content, headers={"content-type": content_type}
    )


def test_cover_endpoint_requires_authentication():
    app.dependency_overrides.pop(get_current_user, None)
    response = client.get("/export-cover", params={"url": COVER_URL})
    assert response.status_code == 401


def test_cover_is_streamed_back_same_origin_with_safe_headers():
    seen = serve(image_response())

    response = client.get("/export-cover", params={"url": COVER_URL})

    assert response.status_code == 200
    assert response.content == JPEG
    assert response.headers["content-type"] == "image/jpeg"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "private" in response.headers["cache-control"]
    assert [str(request.url) for request in seen] == [COVER_URL]


def test_cover_endpoint_is_off_when_export_artwork_is_disabled(monkeypatch):
    seen = serve(image_response())
    monkeypatch.setattr(
        "api.routers.export_cover.settings",
        dataclasses.replace(settings, export_cover_artwork_enabled=False),
    )

    response = client.get("/export-cover", params={"url": COVER_URL})

    assert response.status_code == 404
    assert seen == []


@pytest.mark.parametrize(
    "url",
    [
        "http://cf.geekdo-images.com/pic.jpg",
        "https://example.com/pic.jpg",
        "https://cf.geekdo-images.com.evil.test/pic.jpg",
        "https://evil.test/https://cf.geekdo-images.com/pic.jpg",
        "https://user:pw@cf.geekdo-images.com/pic.jpg",
        "https://cf.geekdo-images.com@evil.test/pic.jpg",
        "https://cf.geekdo-images.com:8443/pic.jpg",
        "https://127.0.0.1/pic.jpg",
        "file:///etc/passwd",
        "//cf.geekdo-images.com/pic.jpg",
        "https://cf.geekdo-images.com/pic with space.jpg",
        "",
    ],
)
def test_only_plain_bgg_image_urls_are_fetched(url):
    seen = serve(image_response())

    response = client.get("/export-cover", params={"url": url})

    assert response.status_code in (400, 422)
    assert seen == []


@pytest.mark.parametrize(
    "handler",
    [
        image_response(status=404),
        image_response(status=500),
        lambda request: httpx.Response(302, headers={"location": "https://evil.test/x.jpg"}),
        image_response(content_type="text/html"),
        image_response(content=b"<svg/>", content_type="image/svg+xml"),
        image_response(content=b""),
        image_response(content=b"x" * (MAX_COVER_BYTES + 1)),
    ],
)
def test_unavailable_or_unsafe_upstream_responses_return_bad_gateway(handler):
    serve(handler)

    response = client.get("/export-cover", params={"url": COVER_URL})

    assert response.status_code == 502


def test_upstream_network_failure_returns_bad_gateway():
    def boom(request):
        raise httpx.ConnectTimeout("slow", request=request)

    serve(boom)

    response = client.get("/export-cover", params={"url": COVER_URL})

    assert response.status_code == 502


def test_validate_cover_url_accepts_the_bgg_host_only():
    assert validate_cover_url(COVER_URL) == COVER_URL
    with pytest.raises(InvalidCoverURLError):
        validate_cover_url("https://cf.geekdo-static.com/pic.jpg")
