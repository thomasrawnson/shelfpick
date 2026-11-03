import json

from dataclasses import dataclass
from datetime import datetime, timezone

MAX_BGSTATS_GAMES = 10_000
MAX_BGSTATS_PLAYERS = 10_000
MAX_BGSTATS_PLAYS = 10_000
MAX_PARTICIPANTS_PER_PLAY = 20
MAX_TOTAL_PARTICIPANTS = 50_000
MAX_DURATION_MINUTES = 7 * 24 * 60


class BGStatsImportLimitError(ValueError):
    pass


@dataclass(frozen=True)
class BGStatsParticipant:
    name: str
    score: float | None
    is_winner: bool


@dataclass(frozen=True)
class BGStatsPlay:
    source_play_id: str
    bgg_id: int
    player_count: int
    played_at: datetime
    duration_minutes: int | None
    participants: list[BGStatsParticipant]


def parse_bgstats_plays(
    json_text: str,
) -> list[BGStatsPlay]:
    data = json.loads(json_text)

    if not isinstance(data, dict):
        raise ValueError("BG Stats export root must be an object")

    games = data.get("games", [])
    players = data.get("players", [])
    raw_plays = data.get("plays", [])
    if not all(isinstance(rows, list) for rows in (games, players, raw_plays)):
        raise ValueError("BG Stats export collections must be lists")
    if len(games) > MAX_BGSTATS_GAMES:
        raise BGStatsImportLimitError("BG Stats export has too many games")
    if len(players) > MAX_BGSTATS_PLAYERS:
        raise BGStatsImportLimitError("BG Stats export has too many players")
    if len(raw_plays) > MAX_BGSTATS_PLAYS:
        raise BGStatsImportLimitError("BG Stats export has too many plays")

    games_by_ref_id = {
        game["id"]: game["bggId"]
        for game in games
        if game.get("id") is not None
        and game.get("bggId")
    }

    players_by_ref_id = {
        player["id"]: player.get("name")
        for player in players
        if player.get("id") is not None
    }

    plays: list[BGStatsPlay] = []

    total_participants = 0

    for item in raw_plays:
        if item.get("ignored"):
            continue

        source_play_id = item.get("uuid")

        if not source_play_id:
            continue
        if len(str(source_play_id)) > 100:
            raise BGStatsImportLimitError(
                "A BG Stats play identifier is too long"
            )

        game_ref_id = item.get("gameRefId")
        bgg_id = games_by_ref_id.get(game_ref_id)

        if not bgg_id:
            continue

        play_date = item.get("playDate")

        if not play_date:
            continue

        participant_rows = []

        player_scores = item.get("playerScores") or []
        if not isinstance(player_scores, list):
            raise ValueError("BG Stats player scores must be a list")
        if len(player_scores) > MAX_PARTICIPANTS_PER_PLAY:
            raise BGStatsImportLimitError(
                "A BG Stats play has too many participants"
            )
        total_participants += len(player_scores)
        if total_participants > MAX_TOTAL_PARTICIPANTS:
            raise BGStatsImportLimitError(
                "BG Stats export has too many participants"
            )

        for player_score in player_scores:
            player_ref_id = (
                player_score.get("playerRefId")
            )

            name = players_by_ref_id.get(
                player_ref_id
            )

            if not name:
                name = "Unknown player"
            name = " ".join(str(name).split())
            if len(name) > 100:
                raise BGStatsImportLimitError(
                    "A BG Stats participant name is too long"
                )

            participant_rows.append(
                BGStatsParticipant(
                    name=name,
                    score=_parse_score(
                        player_score.get("score")
                    ),
                    is_winner=bool(
                        player_score.get("winner")
                    ),
                )
            )

        if not participant_rows:
            continue

        played_at = _parse_datetime(
            play_date
        )

        duration_minutes = item.get("durationMin")
        if duration_minutes is not None:
            if not isinstance(duration_minutes, int):
                raise ValueError("BG Stats duration must be a whole number")
            if duration_minutes < 0 or duration_minutes > MAX_DURATION_MINUTES:
                raise BGStatsImportLimitError(
                    "A BG Stats play duration is outside the safe range"
                )

        plays.append(
            BGStatsPlay(
                source_play_id=source_play_id,
                bgg_id=bgg_id,
                player_count=len(
                    participant_rows
                ),
                played_at=played_at,
                duration_minutes=duration_minutes,
                participants=participant_rows,
            )
        )

    return plays


def _parse_score(
    value,
) -> float | None:
    if value is None:
        return None

    if isinstance(
        value,
        str,
    ):
        value = value.strip()

        if not value:
            return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(
        value.replace("Z", "+00:00")
    )

    if parsed.tzinfo is None:
        parsed = parsed.replace(
            tzinfo=timezone.utc
        )

    return parsed
