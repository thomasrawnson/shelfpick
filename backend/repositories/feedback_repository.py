from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database.models import Feedback


class FeedbackRepository:
    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id

    def count_since(self, since: datetime) -> int:
        return self.db.scalar(
            select(func.count(Feedback.id)).where(
                Feedback.user_id == self.user_id,
                Feedback.created_at >= since,
            )
        ) or 0

    def add(self, **fields) -> Feedback:
        feedback = Feedback(user_id=self.user_id, **fields)
        self.db.add(feedback)
        self.db.commit()
        self.db.refresh(feedback)
        return feedback
