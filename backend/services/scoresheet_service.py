"""Scoresheet library: built-in seeding, custom sheets and play scoring."""

import json
from pathlib import Path

from database.models import Scoresheet
from repositories.scoresheet_repository import ScoresheetRepository
from services import scoresheet_engine as engine
from services.scoresheet_validation import (
    TEMPLATES_DIR,
    custom_sheet_problems,
    template_problems,
)

CUSTOM_SOURCE = {
    "rulebook_title": "Custom scoresheet",
    "edition_or_year": "Custom",
    "checked_against_rulebook": False,
}


class ScoresheetNotFound(Exception):
    pass


def serialize_sheet(
    sheet: Scoresheet,
    schema: dict | None = None,
    version: int | None = None,
) -> dict:
    return {
        "id": sheet.id,
        "bgg_id": sheet.bgg_game_id,
        "kind": "builtin" if sheet.owner_user_id is None else "custom",
        "version": version if version is not None else sheet.version,
        "current_version": sheet.version,
        "archived": sheet.archived_at is not None,
        "schema": schema if schema is not None else sheet.schema,
    }


def load_templates(templates_dir: Path = TEMPLATES_DIR) -> list[dict]:
    """Read and validate every template; raise before anything is written."""
    templates = []
    problems = []
    for path in sorted(templates_dir.glob("*.json")):
        template = json.loads(path.read_text("utf-8"))
        issues = template_problems(template)
        if not issues and not path.name.startswith(f"{template['bgg_id']}-"):
            issues = ["file name bgg_id does not match template"]
        problems.extend(f"{path.name}: {issue}" for issue in issues)
        templates.append(template)
    if problems:
        raise ValueError("Invalid scoresheet templates:\n" + "\n".join(problems))
    ids = [template["bgg_id"] for template in templates]
    if len(set(ids)) != len(ids):
        raise ValueError("Two scoresheet templates share a bgg_id.")
    return templates


def seed_builtin_scoresheets(
    repository: ScoresheetRepository,
    templates_dir: Path = TEMPLATES_DIR,
) -> dict[str, int]:
    """Create or version built-in sheets so they match the template folder.

    Idempotent: unchanged templates write nothing. A changed template becomes
    the sheet's next version; earlier versions stay stored for old plays.
    Built-ins whose file was removed are left in place for the same reason.
    """
    counts = {"created": 0, "updated": 0, "unchanged": 0}
    for template in load_templates(templates_dir):
        existing = repository.get_builtin(template["bgg_id"])
        if existing is None:
            repository.create(template, owner_user_id=None)
            counts["created"] += 1
        elif existing.schema != template:
            repository.replace_schema(existing, template)
            counts["updated"] += 1
        else:
            counts["unchanged"] += 1
    repository.commit()
    return counts


class ScoresheetService:
    def __init__(self, repository: ScoresheetRepository):
        self.repository = repository

    def list_for_game(self, bgg_id: int) -> list[dict]:
        return [
            serialize_sheet(sheet)
            for sheet in self.repository.list_for_game(bgg_id)
        ]

    def list_mine(self) -> list[dict]:
        return [serialize_sheet(sheet) for sheet in self.repository.list_mine()]

    def get(self, scoresheet_id: int, version: int | None = None) -> dict:
        sheet, schema, version = self.resolve(scoresheet_id, version)
        return serialize_sheet(sheet, schema, version)

    def resolve(
        self, scoresheet_id: int, version: int | None = None,
    ) -> tuple[Scoresheet, dict, int]:
        """The caller-visible sheet and the schema of one of its versions."""
        sheet = self.repository.get_visible(scoresheet_id)
        if sheet is None:
            raise ScoresheetNotFound()
        if version is None or version == sheet.version:
            return sheet, sheet.schema, sheet.version
        stored = self.repository.get_version(sheet, version)
        if stored is None:
            raise ScoresheetNotFound()
        return sheet, stored.schema, stored.version

    def create(self, schema: dict) -> dict:
        schema = self._clean_custom(schema)
        sheet = self.repository.create(
            schema, owner_user_id=self.repository.user_id,
        )
        self.repository.commit()
        return serialize_sheet(sheet)

    def update(self, scoresheet_id: int, schema: dict) -> dict:
        sheet = self.repository.get_mine(scoresheet_id)
        if sheet is None:
            raise ScoresheetNotFound()
        schema = self._clean_custom(schema)
        if schema != sheet.schema:
            self.repository.replace_schema(sheet, schema)
            self.repository.commit()
        return serialize_sheet(sheet)

    def delete(self, scoresheet_id: int) -> None:
        sheet = self.repository.get_mine(scoresheet_id)
        if sheet is None:
            raise ScoresheetNotFound()
        self.repository.archive(sheet)
        self.repository.commit()

    @staticmethod
    def _clean_custom(schema: dict) -> dict:
        if not isinstance(schema, dict):
            raise ValueError("A scoresheet must be an object.")
        # Custom sheets never claim to have been checked against a rulebook.
        cleaned = {**schema, "source": dict(CUSTOM_SOURCE)}
        cleaned.setdefault("notes", "")
        problems = custom_sheet_problems(cleaned)
        if problems:
            raise ValueError("; ".join(problems[:5]))
        return cleaned


def apply_scoresheet(
    schema: dict,
    outcome_type: str,
    coop_result: str | None,
    participants: list[dict],
    result_override: bool,
) -> tuple[str, str | None, list[dict]]:
    """Score a play from its breakdowns.

    Every participant's ``score`` becomes the sheet total. Without an
    override the sheet also decides the outcome type, ranks and winners;
    with one the client's result fields are kept and validated later by
    ``normalize_results``. Co-op sheets record one team score, so every
    participant carries the same breakdown.
    """
    rows = []
    for index, participant in enumerate(participants, start=1):
        breakdown = participant.get("score_breakdown")
        if breakdown is None:
            raise ValueError(
                "Every player needs scoresheet entries, even if empty."
            )
        problems = engine.check_inputs(schema, breakdown)
        if problems:
            raise ValueError(
                f"Player {index}: " + "; ".join(problems[:3])
            )
        rows.append({**participant, "score_breakdown": breakdown})

    cooperative = schema["win_condition"] == "cooperative"
    if cooperative and any(
        row["score_breakdown"] != rows[0]["score_breakdown"] for row in rows
    ):
        raise ValueError("A co-op scoresheet records one team score.")

    scored = engine.score_play(
        schema, [row["score_breakdown"] for row in rows]
    )
    for row, total in zip(rows, scored["totals"]):
        row["score"] = total

    if result_override:
        return outcome_type, coop_result, rows

    if cooperative:
        for row in rows:
            row.update(team=None, rank=None, is_winner=False)
        return "cooperative", coop_result, rows

    if len(rows) == 1:
        rows[0].update(team=None, rank=None, is_winner=False)
        reached = engine.target_reached(schema, scored["totals"][0])
        if reached is not None:
            coop_result = "won" if reached else "lost"
        return "solo", coop_result, rows

    ranks = scored["ranks"] or [None] * len(rows)
    for row, rank in zip(rows, ranks):
        row.update(team=None, rank=rank, is_winner=False)
    return "competitive", None, rows
