from sqlalchemy.exc import (
    IntegrityError,
)

from database.models import (
    Game as DatabaseGame,
)
from database.models import (
    Play as DatabasePlay,
)
from database.models import (
    PlayParticipant,
    Player,
    UserGame,
    LivePlayTimer,
)
from models.play import (
    Play as DomainPlay,
)


class PlayWriteRepository:
    def create(
        self,
        bgg_id: int,
        played_at,
        duration_minutes: int | None,
        participants: list[dict],
        location: str | None = None,
        timer_session_id: str | None = None,
    ) -> DomainPlay | None:
        if self.user_id is None:
            raise ValueError(
                "user_id is required "
                "to record a play"
            )

        if timer_session_id is not None:
            existing = (
                self.db.query(DatabasePlay)
                .filter(
                    DatabasePlay.user_id == self.user_id,
                    DatabasePlay.timer_session_id == timer_session_id,
                )
                .first()
            )
            if existing is not None:
                game = self.db.get(DatabaseGame, existing.game_id)
                if game.bgg_id != bgg_id:
                    raise ValueError("Finished timer not found for this game.")
                return DomainPlay(
                    id=existing.id,
                    bgg_id=game.bgg_id,
                    player_count=existing.player_count,
                    played_at=existing.played_at,
                    duration_minutes=existing.duration_minutes,
                    location=existing.location,
                )

        database_game = (
            self.db.query(DatabaseGame)
            .join(
                UserGame,
                UserGame.game_id
                == DatabaseGame.id,
            )
            .filter(
                DatabaseGame.bgg_id
                == bgg_id,
                UserGame.user_id
                == self.user_id,
            )
            .first()
        )

        if database_game is None:
            return None

        timer = None
        if timer_session_id is not None:
            timer = (
                self.db.query(LivePlayTimer)
                .filter(
                    LivePlayTimer.user_id == self.user_id,
                    LivePlayTimer.public_id == timer_session_id,
                )
                .first()
            )
            if timer is None or timer.status != "finished" or timer.game_id != database_game.id:
                raise ValueError("Finished timer not found for this game.")

        database_play = DatabasePlay(
            user_id=self.user_id,
            game_id=database_game.id,
            player_count=len(participants),
            duration_minutes=duration_minutes,
            location=location,
            timer_session_id=timer_session_id,
        )

        if played_at is not None:
            database_play.played_at = played_at

        self.db.add(database_play)
        try:
            self.db.flush()
        except IntegrityError:
            self.db.rollback()
            if timer_session_id is None:
                raise
            existing = (
                self.db.query(DatabasePlay)
                .filter(
                    DatabasePlay.user_id == self.user_id,
                    DatabasePlay.timer_session_id == timer_session_id,
                )
                .first()
            )
            if existing is None:
                raise
            game = self.db.get(DatabaseGame, existing.game_id)
            if game.bgg_id != bgg_id:
                raise ValueError("Finished timer not found for this game.")
            return DomainPlay(
                id=existing.id,
                bgg_id=game.bgg_id,
                player_count=existing.player_count,
                played_at=existing.played_at,
                duration_minutes=existing.duration_minutes,
                location=existing.location,
            )

        for participant in participants:
            player = (
                self._get_or_create_player(
                    participant["name"]
                )
            )
            database_play.participants.append(
                PlayParticipant(
                    player_id=player.id,
                    name=player.name,
                    score=participant.get(
                        "score"
                    ),
                    is_winner=participant.get(
                        "is_winner",
                        False,
                    ),
                )
            )

        if timer is not None:
            self.db.delete(timer)
            
        self.db.commit()
        self.db.refresh(database_play)

        return DomainPlay(
            id=database_play.id,
            bgg_id=database_game.bgg_id,
            player_count=(
                database_play.player_count
            ),
            played_at=(
                database_play.played_at
            ),
            duration_minutes=database_play.duration_minutes,
            location=database_play.location,
        )
    @staticmethod
    def _normalize_player_name(
        name: str,
    ) -> str:
        return " ".join(
            name.strip().lower().split()
        )


    def _get_or_create_player(
        self,
        name: str,
    ) -> Player:
        if self.user_id is None:
            raise ValueError(
                "user_id is required "
                "to resolve a player"
            )

        cleaned_name = " ".join(
            name.strip().split()
        )

        normalized_name = (
            self._normalize_player_name(
                cleaned_name
            )
        )

        player = (
            self.db.query(Player)
            .filter(
                Player.user_id
                == self.user_id,
                Player.normalized_name
                == normalized_name,
            )
            .first()
        )

        if player is not None:
            return player

        player = Player(
            user_id=self.user_id,
            name=cleaned_name,
            normalized_name=(
                normalized_name
            ),
        )

        self.db.add(player)
        self.db.flush()

        return player

    def exists_by_source_play_id(
        self,
        source: str,
        source_play_id: str,
    ) -> bool:
        if self.user_id is None:
            return False

        return (
            self.db.query(DatabasePlay.id)
            .filter(
                DatabasePlay.user_id
                == self.user_id,
                DatabasePlay.source
                == source,
                DatabasePlay.source_play_id
                == source_play_id,
            )
            .first()
            is not None
        )

    def enrich_imported_participants(
        self,
        source: str,
        source_play_id: str,
        participants: list[dict],
    ) -> bool:
        if self.user_id is None:
            return False

        database_play = (
            self.db.query(DatabasePlay)
            .filter(
                DatabasePlay.user_id
                == self.user_id,
                DatabasePlay.source
                == source,
                DatabasePlay.source_play_id
                == source_play_id,
            )
            .first()
        )

        if database_play is None:
            return False

        if database_play.participants:
            return False

        for participant in participants:
            player = (
                self._get_or_create_player(
                    participant["name"]
                )
            )

            database_play.participants.append(
                PlayParticipant(
                    player_id=player.id,
                    name=player.name,
                    score=participant.get(
                        "score"
                    ),
                    is_winner=participant.get(
                        "is_winner",
                        False,
                    ),
                )
            )

        database_play.player_count = len(
            participants
        )

        self.db.commit()

        return True

    def create_imported(
        self,
        bgg_id: int,
        player_count: int,
        played_at,
        duration_minutes: int | None,
        source: str,
        source_play_id: str,
        participants: list[dict],
    ) -> bool:
        if self.user_id is None:
            raise ValueError(
                "user_id is required "
                "to import plays"
            )

        existing_play = (
            self.db.query(DatabasePlay)
            .filter(
                DatabasePlay.user_id
                == self.user_id,
                DatabasePlay.source
                == source,
                DatabasePlay.source_play_id
                == source_play_id,
            )
            .first()
        )

        if existing_play is not None:
            self.enrich_imported_participants(
                source=source,
                source_play_id=source_play_id,
                participants=participants,
            )

            return False

        database_game = (
            self.db.query(DatabaseGame)
            .join(
                UserGame,
                UserGame.game_id
                == DatabaseGame.id,
            )
            .filter(
                DatabaseGame.bgg_id
                == bgg_id,
                UserGame.user_id
                == self.user_id,
            )
            .first()
        )

        if database_game is None:
            return False

        database_play = DatabasePlay(
            user_id=self.user_id,
            game_id=database_game.id,
            player_count=player_count,
            played_at=played_at,
            duration_minutes=duration_minutes,
            source=source,
            source_play_id=source_play_id,
        )

        self.db.add(
            database_play
        )

        try:
            self.db.flush()
        except IntegrityError:
            # Narrow race window: another
            # request imported the same
            # source_play_id between our
            # existence check above and
            # this insert. Fall back to
            # the same "already exists"
            # handling rather than
            # surfacing a raw 500.
            self.db.rollback()

            self.enrich_imported_participants(
                source=source,
                source_play_id=source_play_id,
                participants=participants,
            )

            return False

        for participant in participants:
            player = (
                self._get_or_create_player(
                    participant["name"]
                )
            )

            database_play.participants.append(
                PlayParticipant(
                    player_id=player.id,
                    name=player.name,
                    score=participant.get(
                        "score"
                    ),
                    is_winner=participant.get(
                        "is_winner",
                        False,
                    ),
                )
            )

        self.db.commit()

        return True

    def delete(
        self,
        play_id: int,
    ) -> bool:
        if self.user_id is None:
            return False

        play = (
            self.db.query(
                DatabasePlay
            )
            .filter(
                DatabasePlay.id
                == play_id,
                DatabasePlay.user_id
                == self.user_id,
            )
            .first()
        )

        if play is None:
            return False

        self.db.delete(
            play
        )

        self.db.commit()

        return True
