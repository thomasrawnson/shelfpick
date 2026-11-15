"""Run from backend/: .venv/bin/python -m prototypes.scoresheets.demo"""

import json

from prototypes.scoresheets.engine import calculate


TEMPLATES = {
    "generic": {"schema_version": 1, "template_id": "fictional_tally", "version": "v1", "bgg_id": None,
                "mode": "generic", "winner": "high", "fields": [
                    {"id": "score", "type": "number", "required": True}]},
    "rounds": {"schema_version": 1, "template_id": "fictional_trails", "version": "v1", "bgg_id": None,
               "mode": "rounds", "winner": "high", "max_rounds": 8, "fields": [
                   {"id": "round_score", "type": "number", "required": True}]},
    "categories": {"schema_version": 1, "template_id": "fictional_garden", "version": "v1", "bgg_id": None,
                   "mode": "categories", "winner": "high", "variants": ["standard", "long"],
                   "expansions": ["moon"], "fields": [
                       {"id": "flowers", "type": "number", "required": True, "group": "garden"},
                       {"id": "trees", "type": "number", "required": True, "multiplier": 2, "group": "garden"},
                       {"id": "has_pond", "type": "boolean", "required": True},
                       {"id": "pond_bonus", "type": "number", "required": True, "group": "bonus",
                        "when": {"field": "has_pond", "equals": True}},
                       {"id": "moon_tokens", "type": "number", "required": False,
                        "group": "bonus", "expansions": ["moon"]}]},
}


SHEETS = {
    "generic": {"template_id": "fictional_tally", "version": "v1", "entrants": [
        {"id": "ada", "cells": {"score": 12}}, {"id": "ben", "cells": {"score": 12}}]},
    "rounds": {"template_id": "fictional_trails", "version": "v1", "entrants": [
        {"id": "ada", "rounds": [4, -2, 8]}, {"id": "ben", "rounds": [3, 4, 1]}]},
    "categories": {"template_id": "fictional_garden", "version": "v1", "variant": "standard",
                   "expansions": ["moon"], "entrants": [
                       {"id": "team_a", "kind": "team", "cells": {"flowers": 3, "trees": 2,
                        "has_pond": True, "pond_bonus": 5, "moon_tokens": 1}},
                       {"id": "team_b", "kind": "team", "cells": {"flowers": 5, "trees": 3,
                        "has_pond": False}}]},
}


if __name__ == "__main__":
    print(json.dumps({name: calculate(TEMPLATES[name], SHEETS[name]) for name in TEMPLATES}, indent=2))
