from dataclasses import dataclass
from datetime import datetime


@dataclass
class Play:
    id: int
    bgg_id: int
    player_count: int
    played_at: datetime
    duration_minutes: int | None = None
    location: str | None = None
