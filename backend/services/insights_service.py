from models.collection_insights import (
    CollectionInsights,
    MonthlyRecap,
    YearRecap,
    YearRecapGame,
)
from datetime import datetime, timezone
import re
from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from repositories.insights_repository import (
    InsightsRepository,
)


class InsightsService:
    def __init__(
        self,
        repository: InsightsRepository,
    ):
        self.repository = repository

    def get_collection_insights(
        self,
    ) -> CollectionInsights:
        total_games = (
            self.repository
            .total_owned_games()
        )

        played_games_count = (
            self.repository
            .played_games_count()
        )

        if total_games:
            collection_played_percentage = round(
                (
                    played_games_count
                    / total_games
                )
                * 100
            )
        else:
            collection_played_percentage = 0

        return CollectionInsights(
            total_games=total_games,
            total_plays=(
                self.repository
                .total_plays()
            ),
            played_games_count=(
                played_games_count
            ),
            historical_played_games_count=(
                self.repository
                .historical_played_games_count()
            ),
            collection_played_percentage=(
                collection_played_percentage
            ),
            total_duration_minutes=(
                self.repository
                .total_duration_minutes()
            ),
            duration_plays=(
                self.repository
                .duration_plays()
            ),
            average_duration_minutes=(
                self.repository
                .average_duration_minutes()
            ),
            most_played=(
                self.repository
                .get_most_played()
            ),
            last_played=(
                self.repository
                .get_last_played()
            ),
            never_played_count=(
                self.repository
                .never_played_count()
            ),
            frequent_players=(
                self.repository
                .get_frequent_players()
            ),
            monthly_activity=(
                self.repository
                .get_monthly_activity()
            ),
            neglected_games=(
                self.repository
                .get_neglected_games()
            ),
            top_games_by_player=(
                self.repository
                .get_top_games_by_player()
            ),
            common_groups=(
                self.repository
                .get_common_groups()
            ),
        )

    def get_monthly_recap(
        self,
        month: str,
        timezone_name: str,
    ) -> MonthlyRecap:
        if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
            raise ValueError("Month must use YYYY-MM format.")

        local_timezone = self._parse_timezone(timezone_name)
        year, month_number = map(int, month.split("-"))
        start_local = datetime(year, month_number, 1, tzinfo=local_timezone)
        if month_number == 12:
            end_local = datetime(year + 1, 1, 1, tzinfo=local_timezone)
        else:
            end_local = datetime(year, month_number + 1, 1, tzinfo=local_timezone)
        result = self.repository.get_monthly_recap(
            start_local.astimezone(timezone.utc),
            end_local.astimezone(timezone.utc),
        )

        for game in result["games"]:
            game.image_url = self._safe_artwork_url(game.image_url)

        return MonthlyRecap(
            month=month,
            month_label=start_local.strftime("%B %Y"),
            total_plays=result["total_plays"],
            unique_games=result["unique_games"],
            total_duration_minutes=result["total_duration_minutes"],
            duration_plays=result["duration_plays"],
            most_played=result["games"][0] if result["games"] else None,
            collage_games=result["games"],
        )

    def get_year_recap(
        self,
        year: int,
        timezone_name: str,
    ) -> YearRecap:
        if not 2000 <= year <= 2100:
            raise ValueError("Year must be between 2000 and 2100.")

        local_timezone = self._parse_timezone(timezone_name)
        start = datetime(year, 1, 1, tzinfo=local_timezone).astimezone(timezone.utc)
        end = datetime(year + 1, 1, 1, tzinfo=local_timezone).astimezone(timezone.utc)
        result = self.repository.get_year_recap(start, end, timezone_name)

        def first_peak(counts: list[int], offset: int) -> int | None:
            peak = max(counts)
            return counts.index(peak) + offset if peak > 0 else None

        return YearRecap(
            year=year,
            total_plays=result["total_plays"],
            unique_games=result["unique_games"],
            total_duration_minutes=result["total_duration_minutes"],
            duration_plays=result["duration_plays"],
            top_games=[
                YearRecapGame(
                    bgg_id=game.bgg_id,
                    name=game.name,
                    play_count=game.play_count,
                )
                for game in result["games"]
            ],
            new_games_count=result["new_games_count"],
            new_games=result["new_games"],
            plays_by_month=result["plays_by_month"],
            busiest_month=first_peak(result["plays_by_month"], 1),
            plays_by_weekday=result["plays_by_weekday"],
            busiest_weekday=first_peak(result["plays_by_weekday"], 1),
            longest_play=result["longest_play"],
            co_players=result["co_players"],
        )

    @staticmethod
    def _parse_timezone(timezone_name: str) -> ZoneInfo:
        try:
            return ZoneInfo(timezone_name)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Timezone must be a valid IANA timezone.") from None

    @staticmethod
    def _safe_artwork_url(value: str | None) -> str | None:
        if not value:
            return None
        parsed = urlparse(value)
        return value if parsed.scheme in {"http", "https"} and parsed.netloc else None
