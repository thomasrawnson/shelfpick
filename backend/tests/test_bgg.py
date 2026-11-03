from types import SimpleNamespace

import httpx
import pytest

from bgg.client import BGGClient, MAX_BGG_RESPONSE_BYTES
from bgg.client import BGGSourceUnavailableError


def test_bgg_client_can_be_created():
    client = BGGClient()

    assert client.timeout == 20.0
    assert client.max_retries == 3


def test_get_game_requests_correct_bgg_endpoint(
    monkeypatch,
):
    requested = {}

    def mock_get(
        url,
        params,
        headers,
        timeout,
    ):
        requested["url"] = url
        requested["params"] = params
        requested["headers"] = headers
        requested["timeout"] = timeout

        request = httpx.Request(
            "GET",
            url,
        )

        return httpx.Response(
            200,
            request=request,
            text=(
                "<items>"
                "<item id='174430'/>"
                "</items>"
            ),
        )

    monkeypatch.setattr(
        httpx,
        "get",
        mock_get,
    )

    client = BGGClient()

    xml = client.get_game(174430)

    assert xml == (
        "<items>"
        "<item id='174430'/>"
        "</items>"
    )

    assert requested["url"] == (
        "https://boardgamegeek.com/"
        "xmlapi2/thing"
    )

    assert requested["params"] == {
        "id": 174430,
        "stats": 1,
    }

    assert requested["timeout"] == 20.0

    assert isinstance(
        requested["headers"],
        dict,
    )


def test_rejects_oversized_bgg_response(monkeypatch):
    def mock_get(url, params, headers, timeout):
        return httpx.Response(
            200,
            request=httpx.Request("GET", url),
            content=b"x" * (MAX_BGG_RESPONSE_BYTES + 1),
        )

    monkeypatch.setattr(httpx, "get", mock_get)

    with pytest.raises(RuntimeError, match="safe size limit"):
        BGGClient().get_game(174430)


def test_rejects_bgg_response_past_absolute_request_deadline(monkeypatch):
    def mock_get(url, params, headers, timeout):
        return httpx.Response(
            200,
            request=httpx.Request("GET", url),
            content=b"<items />",
        )

    ticks = iter((0.0, 21.0))
    monkeypatch.setattr(httpx, "get", mock_get)
    monkeypatch.setattr("bgg.client.time.monotonic", lambda: next(ticks))

    with pytest.raises(httpx.ReadTimeout, match="request deadline"):
        BGGClient(timeout=20).get_game(174430)


def test_get_game_retries_when_bgg_returns_202(
    monkeypatch,
):
    calls = []

    def mock_get(
        url,
        params,
        headers,
        timeout,
    ):
        calls.append(url)

        request = httpx.Request(
            "GET",
            url,
        )

        if len(calls) == 1:
            return httpx.Response(
                202,
                request=request,
            )

        return httpx.Response(
            200,
            request=request,
            text=(
                "<items>"
                "<item id='174430'/>"
                "</items>"
            ),
        )

    monkeypatch.setattr(
        httpx,
        "get",
        mock_get,
    )

    client = BGGClient(
        retry_delay=0,
        max_retries=3,
    )

    xml = client.get_game(174430)

    assert xml == (
        "<items>"
        "<item id='174430'/>"
        "</items>"
    )

    assert len(calls) == 2


def test_get_game_retries_when_rate_limited(
    monkeypatch,
):
    calls = []

    def mock_get(
        url,
        params,
        headers,
        timeout,
    ):
        calls.append(url)

        request = httpx.Request(
            "GET",
            url,
        )

        if len(calls) == 1:
            return httpx.Response(
                429,
                request=request,
            )

        return httpx.Response(
            200,
            request=request,
            text=(
                "<items>"
                "<item id='174430'/>"
                "</items>"
            ),
        )

    monkeypatch.setattr(
        httpx,
        "get",
        mock_get,
    )

    client = BGGClient(
        retry_delay=0,
        max_retries=3,
    )

    monkeypatch.setattr(
        "bgg.client.time.sleep",
        lambda _: None,
    )

    xml = client.get_game(174430)

    assert xml == (
        "<items>"
        "<item id='174430'/>"
        "</items>"
    )

    assert len(calls) == 2

def test_rate_limit_wait_is_capped(
    monkeypatch,
):
    waits = []
    calls = []

    def mock_get(
        url,
        params,
        headers,
        timeout,
    ):
        calls.append(url)

        request = httpx.Request(
            "GET",
            url,
        )

        if len(calls) == 1:
            return httpx.Response(
                429,
                request=request,
                headers={
                    "Retry-After": "120"
                },
            )

        return httpx.Response(
            200,
            request=request,
            text="<items />",
        )

    monkeypatch.setattr(
        httpx,
        "get",
        mock_get,
    )

    monkeypatch.setattr(
        "bgg.client.time.sleep",
        lambda seconds:
            waits.append(seconds),
    )

    client = BGGClient(
        max_retries=2,
        max_retry_wait=30,
    )

    client.get_game(174430)

    assert waits == [30]


def test_rate_limit_uses_retry_after(
    monkeypatch,
):
    waits = []
    calls = []

    def mock_get(
        url,
        params,
        headers,
        timeout,
    ):
        calls.append(url)

        request = httpx.Request(
            "GET",
            url,
        )

        if len(calls) == 1:
            return httpx.Response(
                429,
                request=request,
                headers={
                    "Retry-After": "7"
                },
            )

        return httpx.Response(
            200,
            request=request,
            text="<items />",
        )

    monkeypatch.setattr(
        httpx,
        "get",
        mock_get,
    )

    monkeypatch.setattr(
        "bgg.client.time.sleep",
        lambda seconds:
            waits.append(seconds),
    )

    client = BGGClient(
        max_retries=2,
    )

    client.get_game(174430)

    assert waits == [7]


def test_rate_limit_fails_after_max_retries(
    monkeypatch,
):
    def mock_get(
        url,
        params,
        headers,
        timeout,
    ):
        request = httpx.Request(
            "GET",
            url,
        )

        return httpx.Response(
            429,
            request=request,
        )

    monkeypatch.setattr(
        httpx,
        "get",
        mock_get,
    )

    monkeypatch.setattr(
        "bgg.client.time.sleep",
        lambda _: None,
    )

    client = BGGClient(
        max_retries=3,
    )

    with pytest.raises(
        RuntimeError,
        match="rate limit exceeded",
    ):
        client.get_game(174430)



def test_queued_request_fails_after_max_retries(
    monkeypatch,
):
    def mock_get(
        url,
        params,
        headers,
        timeout,
    ):
        request = httpx.Request(
            "GET",
            url,
        )

        return httpx.Response(
            202,
            request=request,
        )

    monkeypatch.setattr(
        httpx,
        "get",
        mock_get,
    )

    monkeypatch.setattr(
        "bgg.client.time.sleep",
        lambda _: None,
    )

    client = BGGClient(
        max_retries=3,
    )

    with pytest.raises(
        RuntimeError,
        match=(
            "remained queued after "
            "maximum retries"
        ),
    ):
        client.get_game(174430)

def test_get_games_batches_ids_in_request(
    monkeypatch,
):
    requested = {}

    def mock_get(
        url,
        params,
        headers,
        timeout,
    ):
        requested["url"] = url
        requested["params"] = params

        request = httpx.Request(
            "GET",
            url,
        )

        return httpx.Response(
            200,
            request=request,
            text="<items />",
        )

    monkeypatch.setattr(
        httpx,
        "get",
        mock_get,
    )

    client = BGGClient()

    client.get_games(
        [
            174430,
            167791,
            13,
        ]
    )

    assert requested["url"] == (
        "https://boardgamegeek.com/"
        "xmlapi2/thing"
    )

    assert requested["params"] == {
        "id": "174430,167791,13",
        "stats": 1,
    }

def test_get_games_handles_empty_list(
    monkeypatch,
):
    called = False

    def mock_get(*args, **kwargs):
        nonlocal called
        called = True

    monkeypatch.setattr(
        httpx,
        "get",
        mock_get,
    )

    client = BGGClient()

    result = client.get_games([])

    assert result == "<items />"
    assert called is False


def test_get_ranked_games_requests_browse_page(
    monkeypatch,
):
    requested = {}

    def mock_get(
        url,
        params,
        headers,
        timeout,
    ):
        requested["url"] = url
        requested["params"] = params
        requested["headers"] = headers
        return httpx.Response(
            200,
            request=httpx.Request("GET", url),
            text="<html />",
        )

    monkeypatch.setattr(httpx, "get", mock_get)

    BGGClient().get_ranked_games_page(3)

    assert requested["url"] == (
        "https://boardgamegeek.com/browse/boardgame"
    )
    assert requested["params"] == {
        "sort": "rank",
        "page": 3,
    }
    assert requested["headers"] == {}


def test_hot_502_is_reported_as_source_unavailable(
    monkeypatch,
):
    calls = []

    def mock_get(
        url,
        params,
        headers,
        timeout,
    ):
        calls.append(url)
        return httpx.Response(
            502,
            request=httpx.Request(
                "GET",
                url,
            ),
        )

    monkeypatch.setattr(
        httpx,
        "get",
        mock_get,
    )

    with pytest.raises(
        BGGSourceUnavailableError,
    ) as error:
        BGGClient().get_hot_games()

    assert error.value.source == "hot"
    assert error.value.status_code == 502
    assert len(calls) == 1


def test_ranked_403_is_not_retried(
    monkeypatch,
):
    calls = []

    def mock_get(
        url,
        params,
        headers,
        timeout,
    ):
        calls.append(url)
        return httpx.Response(
            403,
            request=httpx.Request(
                "GET",
                url,
            ),
        )

    monkeypatch.setattr(
        httpx,
        "get",
        mock_get,
    )

    with pytest.raises(
        BGGSourceUnavailableError,
    ) as error:
        BGGClient(
            max_retries=5,
        ).get_ranked_games_page(1)

    assert error.value.source == "ranked"
    assert error.value.status_code == 403
    assert len(calls) == 1


def test_ranked_502_is_reported_as_source_unavailable(
    monkeypatch,
):
    calls = []

    def mock_get(
        url,
        params,
        headers,
        timeout,
    ):
        calls.append(url)
        return httpx.Response(
            502,
            request=httpx.Request(
                "GET",
                url,
            ),
        )

    monkeypatch.setattr(
        httpx,
        "get",
        mock_get,
    )

    with pytest.raises(
        BGGSourceUnavailableError,
    ) as error:
        BGGClient().get_ranked_games_page(1)

    assert error.value.source == "ranked"
    assert error.value.status_code == 502
    assert len(calls) == 1


def test_xml_requests_keep_api_authentication(
    monkeypatch,
):
    requested = {}

    def mock_get(
        url,
        params,
        headers,
        timeout,
    ):
        requested["headers"] = headers
        return httpx.Response(
            200,
            request=httpx.Request(
                "GET",
                url,
            ),
            text="<items />",
        )

    monkeypatch.setattr(
        "bgg.client.settings",
        SimpleNamespace(
            bgg_api_token=(
                "test-token-not-a-real-secret"
            ),
        ),
    )
    monkeypatch.setattr(
        httpx,
        "get",
        mock_get,
    )

    BGGClient().get_game(1)

    assert requested["headers"] == {
        "Authorization": (
            "Bearer test-token-not-a-real-secret"
        )
    }
