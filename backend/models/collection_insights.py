from dataclasses import dataclass
from datetime import datetime


@dataclass
class GamePlaySummary:
    bgg_id: int
    name: str
    play_count: int


@dataclass
class LastPlayedGame:
    bgg_id: int
    name: str
    played_at: datetime


@dataclass
class PlayerSummary:
    id: int
    name: str
    play_count: int
    win_count: int


@dataclass
class NeglectedGame:
    bgg_id: int
    name: str
    play_count: int
    last_played_at: datetime | None


@dataclass
class PlayerTopGame:
    player_id: int
    player_name: str
    bgg_id: int
    game_name: str
    play_count: int


@dataclass
class PlayerGroupSummary:
    player_ids: list[int]
    player_names: list[str]
    play_count: int

@dataclass
class MonthlyPlay:
    play_id: int
    bgg_id: int
    game_name: str
    played_at: datetime
    player_count: int
@dataclass
class MonthlyActivity:
    plays: int
    unique_games: int
    new_games: int
    repeat_plays: int
    recent_plays: list[MonthlyPlay]


@dataclass
class MonthlyRecapGame:
    bgg_id: int
    name: str
    play_count: int
    image_url: str | None


@dataclass
class MonthlyRecap:
    month: str
    month_label: str
    total_plays: int
    unique_games: int
    total_duration_minutes: int | None
    duration_plays: int
    most_played: MonthlyRecapGame | None
    collage_games: list[MonthlyRecapGame]
@dataclass
class CollectionInsights:
    total_games: int
    total_plays: int
    played_games_count: int
    historical_played_games_count: int
    collection_played_percentage: int
    total_duration_minutes: int | None
    duration_plays: int
    average_duration_minutes: int | None
    most_played: GamePlaySummary | None
    last_played: LastPlayedGame | None
    never_played_count: int
    frequent_players: list[PlayerSummary]
    monthly_activity: MonthlyActivity
    neglected_games: list[NeglectedGame]
    top_games_by_player: list[PlayerTopGame]
    common_groups: list[PlayerGroupSummary]
