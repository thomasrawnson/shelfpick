import logging

import httpx

from config import settings


logger = logging.getLogger(
    "boardgamepicker.email"
)


def send_email(
    to_email: str,
    subject: str,
    html: str,
) -> str | None:
    if (
        settings.environment
        != "production"
    ):
        logger.info(
            "email_preview "
            "to=%s subject=%s",
            to_email,
            subject,
        )

        logger.debug(
            "email_html %s",
            html,
        )

        return None

    response = httpx.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": (
                "Bearer "
                f"{settings.resend_api_key}"
            ),
            "Content-Type":
                "application/json",
        },
        json={
            "from":
                settings.email_from,
            "to": [
                to_email
            ],
            "subject":
                subject,
            "html":
                html,
        },
        timeout=10.0,
    )

    response.raise_for_status()

    message_id = response.json().get(
        "id"
    )

    logger.info(
        "email_sent message_id=%s",
        message_id,
    )

    return message_id
