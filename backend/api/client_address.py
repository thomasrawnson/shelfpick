from ipaddress import ip_address

from fastapi import Request

from config import settings


def trusted_client_address(request: Request) -> str:
    """Return a non-spoofable rate-limit identity for the active host."""
    if settings.environment == "production":
        candidate = request.headers.get("CF-Connecting-IP", "").strip()
        try:
            return str(ip_address(candidate))
        except ValueError:
            # Fail closed: clients without Render's edge header share one
            # limiter identity instead of controlling their own bucket key.
            return "untrusted-render-client"

    return request.client.host if request.client else "unknown"
