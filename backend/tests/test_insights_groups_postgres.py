from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

from sqlalchemy import event

from database.connection import SessionLocal, engine
from database.models import (
    Game,
    Play,
    PlayParticipant,
    Player,
    User,
    UserGame,
)
from repositories.insights_repository import InsightsRepository


EMAILS = [
    "insights-groups-owner@boardgamepicker.local",
    "insights-groups-other@boardgamepicker.local",
    "insights-groups-empty@boardgamepicker.local",
]
BGG_ID = 999215


@contextmanager
def count_queries():
    count = {"value": 0}

    def before_cursor_execute(*_args):
        count["value"] += 1

    event.listen(
        engine,
        "before_cursor_execute",
        before_cursor_execute,
    )
    try:
        yield count
    finally:
        event.remove(
            engine,
            "before_cursor_execute",
            before_cursor_execute,
        )


def clean_fixture(db):
    users = db.query(User).filter(
        User.email.in_(EMAILS)
    ).all()
    user_ids = [user.id for user in users]
    if user_ids:
        play_ids = db.query(Play.id).filter(
            Play.user_id.in_(user_ids)
        )
        db.query(PlayParticipant).filter(
            PlayParticipant.play_id.in_(play_ids)
        ).delete(synchronize_session=False)
        db.query(Play).filter(
            Play.user_id.in_(user_ids)
        ).delete(synchronize_session=False)
        db.query(Player).filter(
            Player.user_id.in_(user_ids)
        ).delete(synchronize_session=False)
        db.query(UserGame).filter(
            UserGame.user_id.in_(user_ids)
        ).delete(synchronize_session=False)
        db.query(User).filter(
            User.id.in_(user_ids)
        ).delete(synchronize_session=False)
    db.query(Game).filter(
        Game.bgg_id == BGG_ID
    ).delete(synchronize_session=False)
    db.commit()


def add_plays(
    db,
    user_id,
    game_id,
    players,
    member_names,
    count,
    offset,
):
    started = datetime(
        2020,
        1,
        1,
        tzinfo=timezone.utc,
    )
    plays = [
        Play(
            user_id=user_id,
            game_id=game_id,
            player_count=len(member_names),
            played_at=(
                started
                + timedelta(minutes=offset + index)
            ),
        )
        for index in range(count)
    ]
    db.add_all(plays)
    db.flush()

    for play in plays:
        for name in member_names:
            player = players[name]
            db.add(
                PlayParticipant(
                    play_id=play.id,
                    player_id=player.id,
                    name=player.name,
                    is_winner=False,
                )
            )


def test_common_groups_handle_empty_and_small_legacy_history():
    db = SessionLocal()
    try:
        clean_fixture(db)
        user = User(
            email=EMAILS[0],
            display_name="Groups Small",
        )
        empty = User(
            email=EMAILS[2],
            display_name="Groups Empty",
        )
        game = Game(
            bgg_id=BGG_ID,
            name="Groups Small Game",
            owned=False,
        )
        db.add_all([user, empty, game])
        db.flush()
        user_id = user.id
        empty_id = empty.id
        alpha = Player(
            user_id=user_id,
            name="Alpha",
            normalized_name="alpha",
        )
        beta = Player(
            user_id=user_id,
            name="Beta",
            normalized_name="beta",
        )
        db.add_all([alpha, beta])
        db.flush()
        play = Play(
            user_id=user_id,
            game_id=game.id,
            player_count=3,
        )
        db.add(play)
        db.flush()
        db.add_all([
            PlayParticipant(
                play_id=play.id,
                player_id=alpha.id,
                name=alpha.name,
                is_winner=False,
            ),
            PlayParticipant(
                play_id=play.id,
                player_id=beta.id,
                name=beta.name,
                is_winner=False,
            ),
            # Legacy/unlinked rows never formed part of regular groups.
            PlayParticipant(
                play_id=play.id,
                player_id=None,
                name="Legacy guest",
                is_winner=False,
            ),
        ])
        db.commit()

        assert InsightsRepository(
            db,
            empty_id,
        ).get_common_groups() == []
        groups = InsightsRepository(
            db,
            user_id,
        ).get_common_groups()
        assert len(groups) == 1
        assert groups[0].player_names == [
            "Alpha",
            "Beta",
        ]
        assert groups[0].play_count == 1
    finally:
        clean_fixture(db)
        db.close()


def test_common_groups_are_aggregated_once_with_exact_account_scoped_semantics():
    db = SessionLocal()
    try:
        clean_fixture(db)
        owner = User(
            email=EMAILS[0],
            display_name="Groups Owner",
        )
        other = User(
            email=EMAILS[1],
            display_name="Groups Other",
        )
        empty = User(
            email=EMAILS[2],
            display_name="Groups Empty",
        )
        game = Game(
            bgg_id=BGG_ID,
            name="Removed Group Game",
            owned=False,
        )
        db.add_all([owner, other, empty, game])
        db.flush()
        owner_id = owner.id
        other_id = other.id
        empty_id = empty.id
        game_id = game.id

        owner_players = {
            name: Player(
                user_id=owner.id,
                name=name,
                normalized_name=name.casefold(),
            )
            for name in [
                "Alpha",
                "Beta",
                "Gamma",
                "Delta",
            ]
        }
        other_players = {
            name: Player(
                user_id=other.id,
                name=name,
                normalized_name=name.casefold(),
            )
            for name in ["Other Alpha", "Other Beta"]
        }
        db.add_all([
            *owner_players.values(),
            *other_players.values(),
        ])
        db.flush()

        removed_membership = UserGame(
            user_id=owner.id,
            game_id=game_id,
        )
        db.add(removed_membership)
        add_plays(
            db,
            owner_id,
            game_id,
            owner_players,
            ["Alpha", "Beta"],
            300,
            0,
        )
        add_plays(
            db,
            owner_id,
            game_id,
            owner_players,
            ["Alpha", "Gamma"],
            250,
            300,
        )
        add_plays(
            db,
            owner_id,
            game_id,
            owner_players,
            ["Alpha", "Delta"],
            250,
            550,
        )
        add_plays(
            db,
            other_id,
            game_id,
            other_players,
            ["Other Alpha", "Other Beta"],
            50,
            800,
        )
        db.commit()

        # Group history remains valid after its game leaves Owned.
        db.delete(removed_membership)
        db.commit()

        with count_queries() as queries:
            groups = InsightsRepository(
                db,
                owner_id,
            ).get_common_groups()

        assert queries["value"] == 1
        assert [
            (group.player_names, group.play_count)
            for group in groups
        ] == [
            (["Alpha", "Beta"], 300),
            (["Alpha", "Delta"], 250),
            (["Alpha", "Gamma"], 250),
        ]
        assert all(
            name not in {
                "Other Alpha",
                "Other Beta",
            }
            for group in groups
            for name in group.player_names
        )

        with count_queries() as empty_queries:
            empty_groups = InsightsRepository(
                db,
                empty_id,
            ).get_common_groups()
        assert empty_queries["value"] == 1
        assert empty_groups == []
    finally:
        clean_fixture(db)
        db.close()
