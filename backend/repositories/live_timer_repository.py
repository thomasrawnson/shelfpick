from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database.models import Game, LivePlayTimer, UserGame


class LiveTimerRepository:
    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    def get(self) -> LivePlayTimer | None:
        return self.db.query(LivePlayTimer).filter(LivePlayTimer.user_id == self.user_id).first()

    def start(self, bgg_id: int, now: datetime, draft_data: dict | None = None) -> LivePlayTimer:
        game = (
            self.db.query(Game)
            .join(UserGame, UserGame.game_id == Game.id)
            .filter(Game.bgg_id == bgg_id, UserGame.user_id == self.user_id)
            .first()
        )
        if game is None:
            raise ValueError("Game not found in your collection.")
        if self.get() is not None:
            raise ValueError("Finish or discard the current timer first.")
        timer = LivePlayTimer(
            public_id=str(uuid4()), user_id=self.user_id, game_id=game.id,
            status="running", accumulated_seconds=0, running_since=now,
            draft_data=draft_data,
        )
        self.db.add(timer)
        try:
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            raise ValueError("Finish or discard the current timer first.") from exc
        self.db.refresh(timer)
        return timer

    def save(self, timer: LivePlayTimer) -> LivePlayTimer:
        self.db.commit()
        self.db.refresh(timer)
        return timer

    def discard(self) -> None:
        timer = self.get()
        if timer is not None:
            self.db.delete(timer)
            self.db.commit()

    def as_dict(self, timer: LivePlayTimer, now: datetime) -> dict:
        elapsed = timer.accumulated_seconds
        if timer.status == "running" and timer.running_since is not None:
            running_since = timer.running_since
            if running_since.tzinfo is None:
                running_since = running_since.replace(tzinfo=timezone.utc)
            elapsed += max(0, int((now - running_since).total_seconds()))
        game = timer.game
        return {
            "public_id": timer.public_id,
            "status": timer.status,
            "accumulated_seconds": timer.accumulated_seconds,
            "running_since": timer.running_since,
            "finished_at": timer.finished_at,
            "elapsed_seconds": elapsed,
            "draft": timer.draft_data or {},
            "game": {
                "bgg_id": game.bgg_id,
                "name": game.name,
                "image_url": game.image_url,
                "thumbnail_url": game.thumbnail_url,
            },
        }
