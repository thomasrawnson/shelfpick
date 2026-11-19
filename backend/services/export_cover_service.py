import time
from urllib.parse import urlsplit

import httpx


ALLOWED_COVER_HOST = "cf.geekdo-images.com"
ALLOWED_CONTENT_TYPES = frozenset(
    {"image/jpeg", "image/png", "image/webp", "image/gif"}
)
MAX_COVER_BYTES = 10 * 1024 * 1024
MAX_COVER_URL_LENGTH = 2048
COVER_DEADLINE_SECONDS = 6.0


class InvalidCoverURLError(ValueError):
    pass


class CoverUnavailableError(RuntimeError):
    pass


def validate_cover_url(url: str) -> str:
    """Accept only a plain HTTPS BoardGameGeek image URL.

    The proxy exists so the browser can read a cover into an export canvas. It
    must never become a general-purpose fetcher, so the host is an exact match.
    """
    if (
        not url
        or len(url) > MAX_COVER_URL_LENGTH
        or any(ord(character) < 33 or ord(character) > 126 for character in url)
    ):
        raise InvalidCoverURLError("Cover URL is not valid.")
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError as exc:
        raise InvalidCoverURLError("Cover URL is not valid.") from exc
    if (
        parts.scheme != "https"
        or parts.hostname != ALLOWED_COVER_HOST
        or port not in (None, 443)
        or parts.username is not None
        or parts.password is not None
    ):
        raise InvalidCoverURLError("Cover URL is not an allowed image source.")
    return url


class ExportCoverService:
    def __init__(self, transport: httpx.BaseTransport | None = None):
        self.transport = transport

    def fetch_cover(self, url: str) -> tuple[bytes, str]:
        """Return the image bytes and content type, or raise CoverUnavailableError."""
        validate_cover_url(url)
        deadline = time.monotonic() + COVER_DEADLINE_SECONDS
        try:
            with httpx.Client(
                transport=self.transport,
                follow_redirects=False,
                timeout=COVER_DEADLINE_SECONDS,
            ) as client:
                with client.stream("GET", url) as response:
                    if response.status_code != 200:
                        raise CoverUnavailableError("Cover image is unavailable.")
                    content_type = (
                        response.headers.get("content-type", "")
                        .split(";")[0]
                        .strip()
                        .lower()
                    )
                    if content_type not in ALLOWED_CONTENT_TYPES:
                        raise CoverUnavailableError("Cover image is unavailable.")
                    body = bytearray()
                    for chunk in response.iter_bytes():
                        if time.monotonic() > deadline:
                            raise CoverUnavailableError("Cover image is unavailable.")
                        body.extend(chunk)
                        if len(body) > MAX_COVER_BYTES:
                            raise CoverUnavailableError("Cover image is unavailable.")
        except httpx.HTTPError as exc:
            raise CoverUnavailableError("Cover image is unavailable.") from exc
        if not body:
            raise CoverUnavailableError("Cover image is unavailable.")
        return bytes(body), content_type
