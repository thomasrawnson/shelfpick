import logging
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from html import escape

from repositories.feedback_repository import FeedbackRepository


logger = logging.getLogger("boardgamepicker.feedback")

FEEDBACK_INBOX = "hello@plutonightlabs.com"
DAILY_LIMIT = 5
TYPE_LABELS = {
    "feature": "Feature idea",
    "problem": "Problem",
    "other": "Other",
}


class FeedbackRateLimitError(Exception):
    pass


class FeedbackService:
    def __init__(
        self,
        repository: FeedbackRepository,
        user_email: str,
        send_email: Callable[[str, str, str], object],
        now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    ):
        self.repository = repository
        self.user_email = user_email
        self.send_email = send_email
        self.now = now

    def submit(
        self,
        type: str,
        message: str,
        wants_reply: bool,
        app_version: str | None = None,
        build: str | None = None,
        os: str | None = None,
        device: str | None = None,
    ):
        # Rolling 24 hours, so the limit can't be doubled across midnight.
        if self.repository.count_since(self.now() - timedelta(days=1)) >= DAILY_LIMIT:
            raise FeedbackRateLimitError(
                "You've sent 5 messages today. Try again tomorrow, "
                "or email hello@plutonightlabs.com."
            )
        feedback = self.repository.add(
            type=type,
            message=message,
            wants_reply=wants_reply,
            app_version=app_version,
            build=build,
            os=os,
            device=device,
        )
        # The message is saved first, so a mail outage never loses it.
        try:
            self.send_email(FEEDBACK_INBOX, self._subject(feedback), self._html(feedback))
        except Exception:
            logger.exception("feedback_notify_failed feedback_id=%s", feedback.id)
        return feedback

    @staticmethod
    def _subject(feedback) -> str:
        return f"ShelfPick feedback: {TYPE_LABELS[feedback.type]} #{feedback.id}"

    def _html(self, feedback) -> str:
        reply = (
            f"Reply to: {escape(self.user_email)}"
            if feedback.wants_reply
            else "No reply wanted (account email withheld)"
        )
        details = [
            f"{label}: {escape(value)}"
            for label, value in (
                ("App", feedback.app_version),
                ("Build", feedback.build),
                ("OS", feedback.os),
                ("Device", feedback.device),
            )
            if value
        ]
        lines = [
            f"<p><strong>{TYPE_LABELS[feedback.type]}</strong></p>",
            f"<p style=\"white-space: pre-wrap\">{escape(feedback.message)}</p>",
            f"<p>{reply}</p>",
        ]
        if details:
            lines.append(f"<p>{'<br>'.join(details)}</p>")
        return "\n".join(lines)
