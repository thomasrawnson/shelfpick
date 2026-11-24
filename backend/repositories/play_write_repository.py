import zlib

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
from repositories.play_read_repository import serialize_play
from models.play import (
    Play as DomainPlay,
)


# Colours a new player can start with. Chosen from the name so it is stable.
PLAYER_AVATAR_KEYS = ("forest", "gold", "clay", "dice", "meeple", "cards")


def default_avatar_key(normalized_name: str) -> str:
    return PLAYER_AVATAR_KEYS[
        zlib.crc32(normalized_name.encode("utf-8")) % len(PLAYER_AVATAR_KEYS)
    ]


class PlayWriteRepository:
    def create(
        self,
        bgg_id: int,
        played_at,
        duration_minutes: int | None,
        participants: list[dict],
        location: str | None = None,
        timer_session_id: str | None = None,
        outcome_type: str = "competitive",
        coop_result: str | None = None,
        scoresheet_id: int | None = None,
        scoresheet_version: int | None = None,
        result_overridden: bool = False,
        client_id: str | None = None,
    ) -> DomainPlay | None:
        if self.user_id is None:
            raise ValueError(
                "user_id is required "
                "to record a play"
            )

        # A repeat of a play the device already sent (a retry after a lost
        # response) returns that play and creates nothing.
        if client_id is not None:
            repeated = self._play_by_client_id(client_id)
            if repeated is not None:
                return repeated

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
            outcome_type=outcome_type,
            coop_result=coop_result,
            scoresheet_id=scoresheet_id,
            scoresheet_version=scoresheet_version,
            result_overridden=result_overridden,
            client_id=client_id,
        )

        if played_at is not None:
            database_play.played_at = played_at

        self.db.add(database_play)
        try:
            self.db.flush()
        except IntegrityError:
            self.db.rollback()
            # Two requests with one client_id raced: the other one won.
            if client_id is not None:
                repeated = self._play_by_client_id(client_id)
                if repeated is not None:
                    return repeated
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
                self._build_participant(player, participant)
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
    def _play_by_client_id(self, client_id: str) -> DomainPlay | None:
        existing = (
            self.db.query(DatabasePlay)
            .filter(
                DatabasePlay.user_id == self.user_id,
                DatabasePlay.client_id == client_id,
            )
            .first()
        )
        if existing is None:
            return None
        game = self.db.get(DatabaseGame, existing.game_id)
        return DomainPlay(
            id=existing.id,
            bgg_id=game.bgg_id,
            player_count=existing.player_count,
            played_at=existing.played_at,
            duration_minutes=existing.duration_minutes,
            location=existing.location,
            created=False,
        )

    @staticmethod
    def _build_participant(
        player: Player,
        data: dict,
    ) -> PlayParticipant:
        return PlayParticipant(
            player_id=player.id,
            name=player.name,
            score=data.get("score"),
            is_winner=data.get("is_winner", False),
            team=data.get("team"),
            rank=data.get("rank"),
            role=data.get("role"),
            score_breakdown=data.get("score_breakdown"),
        )

    def get_play_for_edit(self, play_id: int) -> dict | None:
        """Return the caller's own play as plain data, or None."""
        play = self._owned_play(play_id)
        if play is None:
            return None
        game = self.db.get(DatabaseGame, play.game_id)
        return {
            "bgg_id": game.bgg_id,
            "played_at": play.played_at,
            "duration_minutes": play.duration_minutes,
            "location": play.location,
            "outcome_type": play.outcome_type,
            "coop_result": play.coop_result,
            "scoresheet_id": play.scoresheet_id,
            "scoresheet_version": play.scoresheet_version,
            "result_override": play.result_overridden,
            "participants": [
                {
                    "name": p.name,
                    "score": p.score,
                    "is_winner": p.is_winner,
                    "team": p.team,
                    "rank": p.rank,
                    "role": p.role,
                    "score_breakdown": p.score_breakdown,
                }
                for p in play.participants
            ],
        }

    def _owned_play(self, play_id: int) -> DatabasePlay | None:
        if self.user_id is None:
            return None
        return (
            self.db.query(DatabasePlay)
            .filter(
                DatabasePlay.id == play_id,
                DatabasePlay.user_id == self.user_id,
            )
            .first()
        )

    def update(self, play_id: int, state: dict) -> dict | None:
        """Replace an owned play's editable fields with ``state``.

        ``source``, ``source_play_id`` and ``timer_session_id`` are never
        touched, so an edited import still matches its BG Stats id.
        Returns the serialised play, or None when it is not found or the
        new game is not in the caller's collection.
        """
        play = self._owned_play(play_id)
        if play is None:
            return None

        game = (
            self.db.query(DatabaseGame)
            .join(UserGame, UserGame.game_id == DatabaseGame.id)
            .filter(
                DatabaseGame.bgg_id == state["bgg_id"],
                UserGame.user_id == self.user_id,
            )
            .first()
        )
        if game is None:
            return None

        play.game_id = game.id
        play.played_at = state["played_at"]
        play.duration_minutes = state["duration_minutes"]
        play.location = state["location"]
        play.outcome_type = state["outcome_type"]
        play.coop_result = state["coop_result"]
        play.scoresheet_id = state["scoresheet_id"]
        play.scoresheet_version = state["scoresheet_version"]
        play.result_overridden = state["result_override"]
        play.player_count = len(state["participants"])

        play.participants.clear()
        self.db.flush()
        for data in state["participants"]:
            player = self._get_or_create_player(data["name"])
            play.participants.append(self._build_participant(player, data))

        self.db.commit()
        self.db.refresh(play)
        return serialize_play(play, game)

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
            avatar_key=default_avatar_key(
                normalized_name
            ),
        )

        self.db.add(player)
        self.db.flush()

        return player

    def create_player(
        self,
        name: str,
    ) -> dict:
        """Create a player for this user, or return the existing one.

        Matching uses the same normalised name as play participants, so
        "alex" and "Alex " resolve to one player.
        """
        player = self._get_or_create_player(name)
        self.db.commit()
        self.db.refresh(player)

        return {
            "id": player.id,
            "name": player.name,
            "avatar_key": player.avatar_key,
        }

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
        commit: bool = True,
        outcome_type: str = "competitive",
        coop_result: str | None = None,
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
                self._build_participant(player, participant)
            )

        database_play.player_count = len(
            participants
        )
        database_play.outcome_type = outcome_type
        database_play.coop_result = coop_result

        if commit:
            self.db.commit()
        else:
            self.db.flush()

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
        commit: bool = True,
        outcome_type: str = "competitive",
        coop_result: str | None = None,
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
                commit=commit,
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
            outcome_type=outcome_type,
            coop_result=coop_result,
        )

        try:
            self.db.add(database_play)
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

            if not commit:
                raise

            self.enrich_imported_participants(
                source=source,
                source_play_id=source_play_id,
                participants=participants,
                commit=commit,
            )

            return False

        for participant in participants:
            player = (
                self._get_or_create_player(
                    participant["name"]
                )
            )

            database_play.participants.append(
                self._build_participant(player, participant)
            )

        if commit:
            self.db.commit()
        else:
            self.db.flush()

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
