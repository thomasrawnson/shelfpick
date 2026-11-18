from datetime import datetime, timezone

from sqlalchemy import or_
from sqlalchemy.orm import Session

from database.models import Scoresheet, ScoresheetVersion


class ScoresheetRepository:
    """Persistence for scoresheets. Custom sheets are scoped to ``user_id``."""

    def __init__(self, db: Session, user_id: int | None = None):
        self.db = db
        self.user_id = user_id

    def _visible(self):
        """Built-ins plus the caller's own sheets (archived included)."""
        query = self.db.query(Scoresheet)
        if self.user_id is None:
            return query.filter(Scoresheet.owner_user_id.is_(None))
        return query.filter(
            or_(
                Scoresheet.owner_user_id.is_(None),
                Scoresheet.owner_user_id == self.user_id,
            )
        )

    def list_for_game(self, bgg_game_id: int) -> list[Scoresheet]:
        return (
            self._visible()
            .filter(
                Scoresheet.bgg_game_id == bgg_game_id,
                Scoresheet.archived_at.is_(None),
            )
            .order_by(
                Scoresheet.owner_user_id.is_not(None),
                Scoresheet.created_at,
                Scoresheet.id,
            )
            .all()
        )

    def list_mine(self) -> list[Scoresheet]:
        return (
            self.db.query(Scoresheet)
            .filter(
                Scoresheet.owner_user_id == self.user_id,
                Scoresheet.archived_at.is_(None),
            )
            .order_by(Scoresheet.updated_at.desc(), Scoresheet.id.desc())
            .all()
        )

    def get_visible(self, scoresheet_id: int) -> Scoresheet | None:
        return self._visible().filter(Scoresheet.id == scoresheet_id).first()

    def get_mine(self, scoresheet_id: int) -> Scoresheet | None:
        if self.user_id is None:
            return None
        return (
            self.db.query(Scoresheet)
            .filter(
                Scoresheet.id == scoresheet_id,
                Scoresheet.owner_user_id == self.user_id,
                Scoresheet.archived_at.is_(None),
            )
            .first()
        )

    def get_version(
        self, scoresheet: Scoresheet, version: int,
    ) -> ScoresheetVersion | None:
        return (
            self.db.query(ScoresheetVersion)
            .filter(
                ScoresheetVersion.scoresheet_id == scoresheet.id,
                ScoresheetVersion.version == version,
            )
            .first()
        )

    def get_builtin(self, bgg_game_id: int) -> Scoresheet | None:
        return (
            self.db.query(Scoresheet)
            .filter(
                Scoresheet.owner_user_id.is_(None),
                Scoresheet.bgg_game_id == bgg_game_id,
            )
            .first()
        )

    def create(
        self, schema: dict, owner_user_id: int | None,
    ) -> Scoresheet:
        sheet = Scoresheet(
            bgg_game_id=schema["bgg_id"],
            owner_user_id=owner_user_id,
            schema=schema,
            format_version=schema["format_version"],
            version=1,
        )
        self.db.add(sheet)
        self.db.flush()
        self._add_version(sheet)
        return sheet

    def replace_schema(self, sheet: Scoresheet, schema: dict) -> Scoresheet:
        """Store ``schema`` as the sheet's next version."""
        sheet.schema = schema
        sheet.bgg_game_id = schema["bgg_id"]
        sheet.format_version = schema["format_version"]
        sheet.version += 1
        sheet.updated_at = datetime.now(timezone.utc)
        self.db.flush()
        self._add_version(sheet)
        return sheet

    def archive(self, sheet: Scoresheet) -> None:
        sheet.archived_at = datetime.now(timezone.utc)
        self.db.flush()

    def _add_version(self, sheet: Scoresheet) -> None:
        self.db.add(
            ScoresheetVersion(
                scoresheet_id=sheet.id,
                version=sheet.version,
                schema=sheet.schema,
                format_version=sheet.format_version,
            )
        )
        self.db.flush()

    def commit(self) -> None:
        self.db.commit()
