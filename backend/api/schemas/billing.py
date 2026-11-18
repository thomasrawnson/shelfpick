from datetime import datetime

from pydantic import BaseModel


class BillingAccountResponse(BaseModel):
    # RevenueCat app user ID for this account; not the email or numeric ID.
    app_user_id: str
    billing_available: bool
    pro: bool
    # "purchase" for a verified App Store purchase, "grant" for a manual or
    # test grant, None on Free.
    source: str | None
    plan: str | None
    expires_at: datetime | None
