from types import SimpleNamespace
import logging

import email_service


class FakeResponse:
    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, str]:
        return {"id": "email-123"}


def test_production_email_uses_resend(
    monkeypatch,
    caplog,
):
    request = {}

    def fake_post(
        url,
        *,
        headers,
        json,
        timeout,
    ):
        request.update(
            url=url,
            headers=headers,
            json=json,
            timeout=timeout,
        )
        return FakeResponse()

    monkeypatch.setattr(
        email_service,
        "settings",
        SimpleNamespace(
            environment="production",
            resend_api_key="re_secret",
            email_from=(
                "BoardGamePicker "
                "<accounts@mail.example.com>"
            ),
        ),
    )
    monkeypatch.setattr(
        email_service.httpx,
        "post",
        fake_post,
    )

    with caplog.at_level(
        logging.INFO,
        logger="boardgamepicker.email",
    ):
        message_id = email_service.send_email(
            "tester@example.com",
            "Verify your email",
            "<p>Verify</p>",
        )

    assert message_id == "email-123"
    assert request["url"] == (
        "https://api.resend.com/emails"
    )
    assert request["timeout"] == 10.0
    assert request["headers"][
        "Authorization"
    ] == "Bearer re_secret"
    assert request["json"] == {
        "from": (
            "BoardGamePicker "
            "<accounts@mail.example.com>"
        ),
        "to": ["tester@example.com"],
        "subject": "Verify your email",
        "html": "<p>Verify</p>",
    }
    assert "email_sent message_id=email-123" in caplog.text
    assert "tester@example.com" not in caplog.text


def test_non_production_email_is_not_sent(
    monkeypatch,
):
    monkeypatch.setattr(
        email_service,
        "settings",
        SimpleNamespace(
            environment="test",
        ),
    )

    def unexpected_post(*args, **kwargs):
        raise AssertionError(
            "Resend should not be called"
        )

    monkeypatch.setattr(
        email_service.httpx,
        "post",
        unexpected_post,
    )

    assert email_service.send_email(
        "tester@example.com",
        "Subject",
        "<p>Body</p>",
    ) is None
