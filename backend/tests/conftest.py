from contextlib import contextmanager

import httpx
import pytest


@pytest.fixture(autouse=True)
def route_streams_through_buffered_test_doubles(monkeypatch):
    """Let existing httpx.get fakes exercise the production streaming path."""

    @contextmanager
    def fake_stream(method, url, params, headers, timeout):
        assert method == "GET"
        yield httpx.get(
            url,
            params=params,
            headers=headers,
            timeout=timeout,
        )

    monkeypatch.setattr(httpx, "stream", fake_stream)
