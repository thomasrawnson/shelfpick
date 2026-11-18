from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.current_user import get_current_user
from api.schemas.feedback import FeedbackCreate
from database.connection import get_db
from database.models import User
from email_service import send_email
from repositories.feedback_repository import FeedbackRepository
from services.feedback_service import FeedbackRateLimitError, FeedbackService


router = APIRouter()


def get_feedback_service(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FeedbackService:
    return FeedbackService(
        FeedbackRepository(db, user_id=current_user.id),
        user_email=current_user.email,
        send_email=send_email,
    )


@router.post("/feedback", status_code=201)
def submit_feedback(
    feedback: FeedbackCreate,
    service: FeedbackService = Depends(get_feedback_service),
):
    try:
        saved = service.submit(**feedback.model_dump())
    except FeedbackRateLimitError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
    return {"id": saved.id, "created_at": saved.created_at}
