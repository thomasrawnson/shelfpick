from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from api.current_user import get_current_user
from api.main import app
from database.connection import Base, get_db
from database.models import Feedback, User
from services.account_service import AccountService
from auth.security import hash_password


@pytest.fixture()
def feedback_api(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)
    session = Session()
    session.add_all([
        User(id=1, email="host@example.com", tier="FREE", password_hash=hash_password("correct horse")),
        User(id=2, email="other@example.com", tier="FREE"),
    ])
    session.commit()

    sent = []
    monkeypatch.setattr(
        "api.routers.feedback.send_email",
        lambda to, subject, html: sent.append((to, subject, html)),
    )

    def override_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1, email="host@example.com")
    try:
        with TestClient(app) as client:
            yield client, Session, sent
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def body(**overrides):
    return {"type": "feature", "message": "Please add a lending tracker.", **overrides}


def test_feedback_is_saved_and_emailed_to_the_inbox(feedback_api):
    client, Session, sent = feedback_api
    response = client.post("/feedback", json=body(
        wants_reply=True, app_version="1.1", build="11", os="iOS 26.1", device="iPhone",
    ))
    assert response.status_code == 201
    with Session() as db:
        saved = db.scalars(select(Feedback)).one()
    assert (saved.user_id, saved.type, saved.wants_reply) == (1, "feature", True)
    assert (saved.app_version, saved.build, saved.os, saved.device) == ("1.1", "11", "iOS 26.1", "iPhone")
    [(to, subject, html)] = sent
    assert to == "hello@plutonightlabs.com"
    assert subject == f"ShelfPick feedback: Feature idea #{saved.id}"
    assert "Reply to: host@example.com" in html
    assert "iOS 26.1" in html


def test_email_withholds_the_address_and_escapes_the_message(feedback_api):
    client, _, sent = feedback_api
    assert client.post("/feedback", json=body(type="problem", message="<script>alert(1)</script> breaks")).status_code == 201
    [(_, subject, html)] = sent
    assert "Problem" in subject
    assert "<script>" not in html and "&lt;script&gt;" in html
    assert "host@example.com" not in html


@pytest.mark.parametrize("payload", [
    body(message="too short"),
    body(message="          padded    "),
    body(message="x" * 2001),
    body(type="praise"),
    body(os="x" * 41),
    {"message": "No type given at all."},
])
def test_invalid_feedback_is_rejected_and_not_saved(feedback_api, payload):
    client, Session, sent = feedback_api
    assert client.post("/feedback", json=payload).status_code == 422
    with Session() as db:
        assert db.scalars(select(Feedback)).all() == []
    assert sent == []


def test_message_is_trimmed_and_2000_characters_are_allowed(feedback_api):
    client, Session, _ = feedback_api
    assert client.post("/feedback", json=body(message="  " + "y" * 2000 + "  ")).status_code == 201
    with Session() as db:
        assert db.scalars(select(Feedback.message)).one() == "y" * 2000


def test_sixth_message_in_a_day_is_rate_limited(feedback_api):
    client, Session, sent = feedback_api
    for _ in range(5):
        assert client.post("/feedback", json=body()).status_code == 201
    limited = client.post("/feedback", json=body())
    assert limited.status_code == 429
    assert "5 messages today" in limited.json()["detail"]
    with Session() as db:
        assert len(db.scalars(select(Feedback)).all()) == 5
    assert len(sent) == 5


def test_rate_limit_counts_only_this_user_and_the_last_day(feedback_api):
    client, Session, _ = feedback_api
    old = datetime.now(timezone.utc) - timedelta(days=2)
    with Session() as db:
        db.add_all([Feedback(user_id=1, type="other", message="An old message.", created_at=old) for _ in range(5)])
        db.add_all([Feedback(user_id=2, type="other", message="Someone else's.") for _ in range(5)])
        db.commit()
    assert client.post("/feedback", json=body()).status_code == 201


def test_feedback_is_saved_even_when_the_email_fails(feedback_api, monkeypatch):
    client, Session, _ = feedback_api

    def broken(*_):
        raise RuntimeError("mail down")

    monkeypatch.setattr("api.routers.feedback.send_email", broken)
    assert client.post("/feedback", json=body()).status_code == 201
    with Session() as db:
        assert len(db.scalars(select(Feedback)).all()) == 1


def test_feedback_requires_sign_in(feedback_api):
    client, Session, _ = feedback_api
    app.dependency_overrides.pop(get_current_user)
    assert client.post("/feedback", json=body()).status_code == 401
    with Session() as db:
        assert db.scalars(select(Feedback)).all() == []


def test_deleting_the_account_deletes_its_feedback(feedback_api):
    client, Session, _ = feedback_api
    assert client.post("/feedback", json=body()).status_code == 201
    with Session() as db:
        db.add(Feedback(user_id=2, type="other", message="Kept for the other user."))
        db.commit()
        AccountService(db).delete_account(db.get(User, 1), "correct horse")
        assert [row.user_id for row in db.scalars(select(Feedback))] == [2]
