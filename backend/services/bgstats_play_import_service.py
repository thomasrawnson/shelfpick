from dataclasses import dataclass

from bgstats.play_parser import (
    parse_bgstats_plays,
)
from repositories.play_repository import (
    PlayRepository,
)
from database.models import User


@dataclass(frozen=True)
class BGStatsPlayImportResult:
    imported: int
    skipped_existing: int
    skipped_missing_game: int


class BGStatsPlayImportService:
    def __init__(
        self,
        repository: PlayRepository,
    ):
        self.repository = repository

    def import_plays(
        self,
        json_text: str,
    ) -> BGStatsPlayImportResult:
        plays = parse_bgstats_plays(
            json_text
        )

        imported = 0
        skipped_existing = 0
        skipped_missing_game = 0

        try:
            # Serialize imports for one account. This closes the unique-key
            # race while keeping the complete file import in one transaction.
            self.repository.db.query(User).filter(
                User.id == self.repository.user_id
            ).with_for_update().one()
            for play in plays:
                if self.repository.exists_by_source_play_id(
                    source="bgstats",
                    source_play_id=play.source_play_id,
                ):
                    self.repository.enrich_imported_participants(
                        source="bgstats",
                        source_play_id=play.source_play_id,
                        participants=[
                            {
                                "name": participant.name,
                                "score": participant.score,
                                "is_winner": participant.is_winner,
                            }
                            for participant in play.participants
                        ],
                        commit=False,
                    )

                    skipped_existing += 1
                    continue

                created = (
                    self.repository.create_imported(
                        bgg_id=play.bgg_id,
                        player_count=play.player_count,
                        played_at=play.played_at,
                        duration_minutes=play.duration_minutes,
                        source="bgstats",
                        source_play_id=play.source_play_id,
                        participants=[
                            {
                                "name": participant.name,
                                "score": participant.score,
                                "is_winner": participant.is_winner,
                            }
                            for participant in play.participants
                        ],
                        commit=False,
                    )
                )

                if created:
                    imported += 1
                else:
                    skipped_missing_game += 1

            self.repository.db.commit()
        except Exception:
            self.repository.db.rollback()
            raise

        return BGStatsPlayImportResult(
            imported=imported,
            skipped_existing=(
                skipped_existing
            ),
            skipped_missing_game=(
                skipped_missing_game
            ),
        )
