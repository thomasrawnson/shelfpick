import time

import httpx

from config import settings

MAX_BGG_RESPONSE_BYTES = 5 * 1024 * 1024


class BGGSourceUnavailableError(
    RuntimeError
):
    def __init__(
        self,
        source: str,
        status_code: int,
        cooldown_active: bool = False,
    ):
        self.source = source
        self.status_code = status_code
        self.cooldown_active = cooldown_active

        super().__init__(
            f"BGG {source} source unavailable "
            f"with HTTP {status_code}"
        )


class BGGClient:
    BASE_URL = (
        "https://boardgamegeek.com/"
        "xmlapi2"
    )

    def __init__(
        self,
        timeout: float = 20.0,
        retry_delay: float = 5.0,
        max_retries: int = 3,
        max_retry_wait: float = 10.0,
    ):
        self.timeout = timeout
        self.retry_delay = retry_delay
        self.max_retries = max_retries
        self.max_retry_wait = (
            max_retry_wait
        )

        self.api_token = (
            settings.bgg_api_token
        )

        self.headers = {}

        if self.api_token:
            self.headers[
                "Authorization"
            ] = (
                f"Bearer "
                f"{self.api_token}"
            )

    def get_collection(
        self,
        username: str,
    ) -> str:
        url = (
            f"{self.BASE_URL}/collection"
        )

        params = {
            "username": username,
            "own": 1,
        }

        return self._get(
            url,
            params,
            "BGG collection request",
        )

    def get_game(
        self,
        bgg_id: int,
    ) -> str:
        url = (
            f"{self.BASE_URL}/thing"
        )

        params = {
            "id": bgg_id,
            "stats": 1,
        }

        return self._get(
            url,
            params,
            "BGG game request",
        )
    
    def get_games(
        self,
        bgg_ids: list[int],
    ) -> str:
        if not bgg_ids:
            return "<items />"

        url = (
            f"{self.BASE_URL}/thing"
        )

        params = {
            "id": ",".join(
                str(bgg_id)
                for bgg_id in bgg_ids
            ),
            "stats": 1,
        }

        return self._get(
            url,
            params,
            "BGG games request",
        )

    def get_hot_games(
        self,
    ) -> str:
        url = (
            f"{self.BASE_URL}/hot"
        )

        params = {
            "type": "boardgame",
        }

        try:
            return self._get(
                url,
                params,
                "BGG hot games request",
            )
        except httpx.HTTPStatusError as exc:
            if 500 <= exc.response.status_code < 600:
                raise BGGSourceUnavailableError(
                    source="hot",
                    status_code=(
                        exc.response.status_code
                    ),
                ) from exc

            raise

    def get_ranked_games_page(
        self,
        page: int,
    ) -> str:
        url = (
            "https://boardgamegeek.com/"
            "browse/boardgame"
        )

        params = {
            "sort": "rank",
            "page": page,
        }

        try:
            return self._get(
                url,
                params,
                "BGG ranked games request",
                headers={},
            )
        except httpx.HTTPStatusError as exc:
            if (
                exc.response.status_code == 403
                or 500
                <= exc.response.status_code
                < 600
            ):
                raise BGGSourceUnavailableError(
                    source="ranked",
                    status_code=(
                        exc.response.status_code
                    ),
                ) from exc

            raise
    
    def search_games(
        self,
        query: str,
    ) -> str:
        url = (
            f"{self.BASE_URL}/search"
        )

        params = {
            "query": query,
            "type": "boardgame",
        }

        return self._get(
            url,
            params,
            "BGG search request",
        )

    def _get(
        self,
        url: str,
        params: dict,
        description: str,
        headers: dict | None = None,
    ) -> str:
        for attempt in range(
            self.max_retries
        ):
            attempt_deadline = time.monotonic() + self.timeout
            with httpx.stream(
                "GET",
                url,
                params=params,
                headers=(
                    self.headers
                    if headers is None
                    else headers
                ),
                timeout=self.timeout,
            ) as response:
                if response.status_code == 202:
                    if self._is_last_attempt(attempt):
                        raise RuntimeError(
                            f"{description} remained queued after maximum retries"
                        )
                    self._sleep(self.retry_delay)
                    continue

                if response.status_code == 429:
                    if self._is_last_attempt(attempt):
                        raise RuntimeError(
                            "BGG rate limit exceeded after maximum retries"
                        )
                    wait_seconds = self._get_retry_wait(response, attempt)
                    print(
                        "BGG rate limit reached. "
                        f"Waiting {wait_seconds:.0f}s..."
                    )
                    self._sleep(wait_seconds)
                    continue

                response.raise_for_status()
                body = bytearray()
                for chunk in response.iter_bytes():
                    if time.monotonic() > attempt_deadline:
                        raise httpx.ReadTimeout(
                            "BGG response exceeded the request deadline",
                            request=response.request,
                        )
                    body.extend(chunk)
                    if len(body) > MAX_BGG_RESPONSE_BYTES:
                        raise RuntimeError(
                            "BGG response exceeded the safe size limit"
                        )
                return bytes(body).decode(response.encoding or "utf-8")

        raise RuntimeError(
            f"Unable to complete "
            f"{description}"
        )

    def _is_last_attempt(
        self,
        attempt: int,
    ) -> bool:
        return (
            attempt
            == self.max_retries - 1
        )

    def _get_retry_wait(
        self,
        response: httpx.Response,
        attempt: int,
    ) -> float:
        retry_after = (
            response.headers.get(
                "Retry-After"
            )
        )

        if retry_after:
            try:
                requested_wait = float(
                    retry_after
                )
            except ValueError:
                requested_wait = (
                    self.retry_delay
                )
        else:
            requested_wait = (
                10 * (attempt + 1)
            )

        return min(
            requested_wait,
            self.max_retry_wait,
        )

    @staticmethod
    def _sleep(
            seconds: float,
        ) -> None:
            time.sleep(seconds)
