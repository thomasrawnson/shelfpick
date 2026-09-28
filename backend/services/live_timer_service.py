from datetime import datetime, timezone
from typing import Callable

from repositories.live_timer_repository import LiveTimerRepository


class LiveTimerService:
    def __init__(self, repository: LiveTimerRepository, clock: Callable[[], datetime] | None = None):
        self.repository = repository
        self.clock = clock or (lambda: datetime.now(timezone.utc))

    def _required(self):
        timer = self.repository.get()
        if timer is None:
            raise ValueError("No active timer.")
        return timer

    def get_active(self):
        timer = self.repository.get()
        return None if timer is None else self.repository.as_dict(timer, self.clock())

    def start(self, bgg_id: int, participant_names: list[str] | None = None, location: str | None = None):
        now = self.clock()
        names = [" ".join(name.split()) for name in (participant_names or [])]
        draft = {
            "participant_names": names,
            "location": " ".join(location.split()) if location else "",
        }
        return self.repository.as_dict(self.repository.start(bgg_id, now, draft), now)

    def pause(self):
        timer = self._required()
        now = self.clock()
        if timer.status == "running" and timer.running_since is not None:
            timer.accumulated_seconds = self.repository.as_dict(timer, now)["elapsed_seconds"]
            timer.running_since = None
            timer.status = "paused"
            self.repository.save(timer)
        return self.repository.as_dict(timer, now)

    def resume(self):
        timer = self._required()
        now = self.clock()
        if timer.status == "paused":
            timer.status = "running"
            timer.running_since = now
            timer.finished_at = None
            self.repository.save(timer)
        return self.repository.as_dict(timer, now)

    def finish(self):
        timer = self._required()
        now = self.clock()
        if timer.status == "running" and timer.running_since is not None:
            timer.accumulated_seconds = self.repository.as_dict(timer, now)["elapsed_seconds"]
        if timer.status != "finished":
            timer.status = "finished"
            timer.running_since = None
            timer.finished_at = now
            self.repository.save(timer)
        return self.repository.as_dict(timer, now)

    def discard(self):
        self.repository.discard()
