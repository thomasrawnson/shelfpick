import xml.etree.ElementTree as ET


def parse_collection_ids(xml: str) -> list[int]:
    root = ET.fromstring(xml)

    return list(dict.fromkeys(
        int(item.attrib["objectid"])
        for item in root.findall("item")
        if (
            item.attrib.get("subtype")
            != "boardgameexpansion"
        )
    ))


def parse_collection_expansion_ids(
    xml: str,
) -> list[int]:
    root = ET.fromstring(xml)

    return list(dict.fromkeys(
        int(item.attrib["objectid"])
        for item in root.findall("item")
        if (
            item.attrib.get("subtype")
            == "boardgameexpansion"
        )
    ))
