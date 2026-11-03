import json

import pytest

from bgstats.play_parser import (
    BGStatsImportLimitError,
    MAX_BGSTATS_GAMES,
    MAX_PARTICIPANTS_PER_PLAY,
    parse_bgstats_plays,
)


def test_parse_bgstats_plays():
    export = {
        "games": [
            {
                "id": 1,
                "bggId": 36218,
                "name": "Dominion",
            },
        ],
        "players": [
            {
                "id": 2,
                "name": "Wales",
            },
            {
                "id": 3,
                "name": "Tom",
            },
        ],
        "plays": [
            {
                "uuid": "play-123",
                "ignored": False,
                "playDate": (
                    "2025-05-10 19:30:00"
                ),
                "durationMin": 53,
                "gameRefId": 1,
                "playerScores": [
                    {
                        "playerRefId": 3,
                        "score": "42",
                        "winner": False,
                    },
                    {
                        "playerRefId": 2,
                        "score": "57.5",
                        "winner": True,
                    },
                ],
            },
        ],
    }

    plays = parse_bgstats_plays(
        json.dumps(export)
    )

    assert len(plays) == 1

    play = plays[0]

    assert play.source_play_id == "play-123"
    assert play.bgg_id == 36218
    assert play.player_count == 2
    assert play.duration_minutes == 53
    assert play.played_at.year == 2025

    assert len(play.participants) == 2

    assert play.participants[0].name == "Tom"
    assert play.participants[0].score == 42.0
    assert (
        play.participants[0].is_winner
        is False
    )

    assert (
        play.participants[1].name
        == "Wales"
    )
    assert (
        play.participants[1].score
        == 57.5
    )
    assert (
        play.participants[1].is_winner
        is True
    )


def test_blank_score_becomes_none():
    export = {
        "games": [
            {
                "id": 1,
                "bggId": 36218,
            },
        ],
        "players": [
            {
                "id": 2,
                "name": "Wales",
            },
        ],
        "plays": [
            {
                "uuid": "play-456",
                "playDate": (
                    "2025-05-10 19:30:00"
                ),
                "gameRefId": 1,
                "playerScores": [
                    {
                        "playerRefId": 2,
                        "score": "",
                        "winner": True,
                    },
                ],
            },
        ],
    }

    play = parse_bgstats_plays(
        json.dumps(export)
    )[0]

    assert (
        play.participants[0].score
        is None
    )


def test_rejects_too_many_game_records():
    export = {
        "games": [
            {"id": index, "bggId": index}
            for index in range(MAX_BGSTATS_GAMES + 1)
        ],
        "players": [],
        "plays": [],
    }

    with pytest.raises(BGStatsImportLimitError, match="too many games"):
        parse_bgstats_plays(json.dumps(export))


def test_rejects_too_many_participants_in_one_play():
    export = {
        "games": [{"id": 1, "bggId": 36218}],
        "players": [
            {"id": index, "name": f"Player {index}"}
            for index in range(MAX_PARTICIPANTS_PER_PLAY + 1)
        ],
        "plays": [{
            "uuid": "too-many-players",
            "playDate": "2026-11-03T12:00:00Z",
            "gameRefId": 1,
            "playerScores": [
                {"playerRefId": index}
                for index in range(MAX_PARTICIPANTS_PER_PLAY + 1)
            ],
        }],
    }

    with pytest.raises(BGStatsImportLimitError, match="too many participants"):
        parse_bgstats_plays(json.dumps(export))
