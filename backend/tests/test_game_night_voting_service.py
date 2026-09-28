from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database.connection import Base
from database.models import Game, User, UserGame
from repositories.game_night_voting_repository import GameNightVotingRepository
from services.game_night_voting_service import (
    GameNightVotingService,
    VotingClosedError,
    VotingExpiredError,
    VotingNotFoundError,
)


@pytest.fixture()
def voting_store():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    session.add_all([
        User(id=1, email="host@example.com", tier="PRO"),
        User(id=2, email="other@example.com", tier="PRO"),
    ])
    games = [
        Game(bgg_id=index, name=f"Game {index}", owned=True)
        for index in range(1, 5)
    ]
    session.add_all(games)
    session.flush()
    session.add_all([
        UserGame(user_id=1, game_id=game.id)
        for game in games
    ])
    session.commit()
    try:
        yield session, games
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def open_session(voting_store):
    session, games = voting_store
    service = GameNightVotingService(GameNightVotingRepository(session))
    opened = service.open_session(
        1, [1, 2, 3], games, "https://app.shelfpick.example",
    )
    join_token = opened["join_url"].rsplit("/", 1)[-1]
    return service, opened, join_token


def test_join_token_and_host_control_are_scoped(voting_store):
    service, opened, join_token = open_session(voting_store)

    assert opened["join_url"].startswith(
        "https://app.shelfpick.example/game-night/join/"
    )
    assert service.public_session(join_token)["status"] == "open"
    with pytest.raises(VotingNotFoundError):
        service.public_session("wrong-token")
    with pytest.raises(VotingNotFoundError):
        service.host_session(opened["session_id"], 2)


def test_retried_ballot_is_one_record_and_vote_can_change(voting_store):
    session, _ = voting_store
    service, _, join_token = open_session(voting_store)
    joined, credential = service.join(join_token, "  Morgan   Lee ")

    assert joined["guest"]["display_name"] == "Morgan Lee"
    first = service.vote(join_token, credential, 1)
    retried = service.vote(join_token, credential, 1)
    changed = service.vote(join_token, credential, 2)

    assert first["guest"]["current_vote"] == 1
    assert retried["ballots_submitted"] == 1
    assert changed["ballots_submitted"] == 1
    assert changed["guest"]["current_vote"] == 2
    assert session.execute(
        text("select count(*) from game_night_ballots")
    ).scalar_one() == 1


def test_close_rejects_votes_and_reports_ties_and_no_vote(voting_store):
    service, opened, join_token = open_session(voting_store)
    _, first_credential = service.join(join_token, "Morgan")
    _, second_credential = service.join(join_token, "Sam")
    service.vote(join_token, first_credential, 1)
    service.vote(join_token, second_credential, 2)

    closed = service.close(opened["session_id"], 1)

    assert closed["results"]["outcome"] == "tie"
    assert closed["results"]["winner_bgg_ids"] == [1, 2]
    with pytest.raises(VotingClosedError):
        service.vote(join_token, first_credential, 3)

    service_two, opened_two, join_token_two = open_session(voting_store)
    _, abstaining_credential = service_two.join(join_token_two, "Alex")
    service_two.vote(join_token_two, abstaining_credential, None)
    no_vote = service_two.close(opened_two["session_id"], 1)
    assert no_vote["results"]["outcome"] == "no_votes"
    assert no_vote["results"]["abstain_count"] == 1


def test_guest_credential_restores_only_its_session_ballot(voting_store):
    service, _, join_token = open_session(voting_store)
    _, credential = service.join(join_token, "Morgan")
    service.vote(join_token, credential, 3)

    restored = service.public_session(join_token, credential)
    service_two, _, join_token_two = open_session(voting_store)
    wrong_session = service_two.public_session(join_token_two, credential)

    assert restored["guest"]["current_vote"] == 3
    assert restored["guest"]["has_submitted"] is True
    assert wrong_session["guest"] is None


def test_expired_session_rejects_guest_access(voting_store):
    session, _ = voting_store
    service, opened, join_token = open_session(voting_store)
    model = service.repository.get_for_host(opened["session_id"], 1)
    model.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    session.commit()

    with pytest.raises(VotingExpiredError):
        service.public_session(join_token)
