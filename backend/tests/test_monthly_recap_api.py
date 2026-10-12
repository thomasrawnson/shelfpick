from fastapi.testclient import TestClient

from api.dependencies import get_insights_service
from api.main import app
from models.collection_insights import MonthlyRecap


client = TestClient(app)


class FakeMonthlyRecapService:
    def get_monthly_recap(self, month, timezone):
        if month == "invalid":
            raise ValueError("Month must use YYYY-MM format.")
        return MonthlyRecap(
            month=month,
            month_label="October 2026",
            total_plays=0,
            unique_games=0,
            total_duration_minutes=None,
            duration_plays=0,
            most_played=None,
            collage_games=[],
        )


def test_monthly_recap_endpoint_requires_authentication():
    response = client.get(
        "/insights/monthly-recap",
        params={"month": "2026-10", "timezone": "Europe/London"},
    )
    assert response.status_code == 401


def test_monthly_recap_endpoint_is_authenticated_and_serializes_empty_month():
    app.dependency_overrides[get_insights_service] = lambda: FakeMonthlyRecapService()
    try:
        response = client.get(
            "/insights/monthly-recap",
            params={"month": "2026-10", "timezone": "Europe/London"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "month": "2026-10",
        "month_label": "October 2026",
        "total_plays": 0,
        "unique_games": 0,
        "total_duration_minutes": None,
        "duration_plays": 0,
        "most_played": None,
        "collage_games": [],
    }
    assert not ({"participants", "scores", "location"} & response.json().keys())


def test_monthly_recap_endpoint_returns_structured_validation_error():
    app.dependency_overrides[get_insights_service] = lambda: FakeMonthlyRecapService()
    try:
        response = client.get(
            "/insights/monthly-recap",
            params={"month": "invalid", "timezone": "Europe/London"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
    assert response.json() == {"detail": "Month must use YYYY-MM format."}
