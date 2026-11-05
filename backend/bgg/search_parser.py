import xml.etree.ElementTree as ET
import unicodedata


def _normalise_title(value: str) -> str:
    return " ".join(
        unicodedata.normalize("NFKC", value)
        .casefold()
        .split()
    )


def rank_search_results(results: list[dict], query: str) -> list[dict]:
    """Rank the full BGG response before the API's result cap is applied."""
    title_query = _normalise_title(query)

    def relevance(result: dict) -> tuple[int, bool, int]:
        title = _normalise_title(result["name"])
        if title == title_query:
            match = 0
        elif title.startswith(title_query):
            match = 1
        elif title_query in title:
            match = 2
        else:
            match = 3

        # An older exact-title release is usually the original edition.
        exact_year = (
            result["year_published"] or 9999
            if match == 0
            else 0
        )
        return (
            match,
            result["item_type"] == "boardgameexpansion",
            exact_year,
        )

    return sorted(results, key=relevance)


def parse_search_results(
    xml: str,
) -> list[dict]:
    root = ET.fromstring(
        xml
    )

    results: list[dict] = []

    for item in root.findall(
        "item"
    ):
        bgg_id = item.get(
            "id"
        )

        names = item.findall("name")
        name_element = next(
            (name for name in names if name.get("type") == "primary"),
            names[0] if names else None,
        )

        if (
            not bgg_id
            or name_element is None
        ):
            continue

        name = name_element.get(
            "value"
        )

        if not name:
            continue

        year_element = item.find(
            "yearpublished"
        )

        year = None

        if year_element is not None:
            value = year_element.get(
                "value"
            )

            if value:
                try:
                    year = int(
                        value
                    )
                except ValueError:
                    pass

        try:
            parsed_bgg_id = int(
                bgg_id
            )
        except ValueError:
            continue

        results.append(
            {
                "bgg_id":
                    parsed_bgg_id,
                "name":
                    name,
                "year_published":
                    year,
                "item_type":
                    item.get("type") or "boardgame",
            }
        )

    return results
