import xml.etree.ElementTree as ET

import httpx
import pytest
from fastapi.testclient import TestClient

from api.main import app, get_collection_service
from bgg.search_parser import parse_search_results, rank_search_results
from services.collection_service import CollectionService


def search_xml(items):
    root = ET.Element("items")
    for bgg_id, name, year, item_type in items:
        item = ET.SubElement(root, "item", id=str(bgg_id), type=item_type)
        ET.SubElement(item, "name", type="primary", value=name)
        ET.SubElement(item, "yearpublished", value=str(year))
    return ET.tostring(root, encoding="unicode")


def test_ticket_to_ride_original_survives_cap_after_expansions():
    items = [
        (100000 + index, f"Ticket to Ride: Fan Expansion {index}", 2020, "boardgameexpansion")
        for index in range(30)
    ]
    items += [
        (9209, "Ticket to Ride", 2004, "boardgame"),
        (200000, "Ticket to Ride: Europe", 2005, "boardgame"),
    ]

    class FakeBGGClient:
        def search_games(self, query):
            assert query == "Ticket to Ride"
            return search_xml(items)

    service = CollectionService(FakeBGGClient(), repository=None)
    results = service.search_games(" Ticket to Ride ")

    assert len(results) == 20
    assert results[0]["bgg_id"] == 9209
    assert results[0]["year_published"] == 2004
    assert results[1]["bgg_id"] == 200000
    assert any(result["item_type"] == "boardgameexpansion" for result in results)


def test_exact_titles_and_base_games_outrank_partial_expansions():
    xml = search_xml([
        (5, "Unofficial Azul Fan Expansion", 2021, "boardgameexpansion"),
        (4, "Azul: Mini Expansion", 2020, "boardgameexpansion"),
        (3, "Azul: Summer Pavilion", 2019, "boardgame"),
        (2, "Azul", 2024, "boardgame"),
        (1, "  AZUL  ", 2017, "boardgame"),
    ])
    ranked = rank_search_results(parse_search_results(xml), "azul")

    assert [result["bgg_id"] for result in ranked] == [1, 2, 3, 4, 5]


def test_parser_prefers_primary_name_and_handles_empty_results():
    xml = """<items><item id='9209' type='boardgame'>
      <name type='alternate' value='Ticket to Ride USA'/>
      <name type='primary' value='Ticket to Ride'/>
      <yearpublished value='2004'/>
    </item></items>"""
    assert parse_search_results(xml)[0]["name"] == "Ticket to Ride"
    assert parse_search_results("<items />") == []


def test_search_failure_still_reaches_existing_api_error_handler():
    class FailingBGGClient:
        def search_games(self, query):
            raise httpx.TimeoutException("source timed out")

    service = CollectionService(FailingBGGClient(), repository=None)
    with pytest.raises(httpx.TimeoutException):
        service.search_games("Ticket to Ride")


def test_search_timeout_keeps_existing_api_message():
    class FailingService:
        def search_games(self, query):
            raise httpx.TimeoutException("source timed out")

    app.dependency_overrides[get_collection_service] = lambda: FailingService()
    try:
        response = TestClient(app).get(
            "/collection/search",
            params={"query": "Ticket to Ride"},
        )
    finally:
        app.dependency_overrides.pop(get_collection_service, None)

    assert response.status_code == 504
    assert response.json() == {
        "detail": "BoardGameGeek took too long to respond. Please try again."
    }
