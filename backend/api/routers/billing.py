import hmac
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from api.current_user import get_current_user
from api.schemas.billing import BillingAccountResponse
from config import settings
from database.connection import get_db
from database.models import User
from repositories.billing_repository import BillingRepository
from services.billing_service import (
    REVERSAL_CANCEL_REASONS,
    TIP_PRODUCT_IDS,
    BillingService,
    RevenueCatClient,
    RevenueCatUnavailableError,
)
from services.entitlements import PlanTier, resolve_tier


router = APIRouter()

# A purchase check is one RevenueCat call, so repeat requests inside this
# window answer from the stored record instead of calling again.
SYNC_MIN_INTERVAL_SECONDS = 2.0
_last_sync_by_user: dict[int, float] = {}


def get_revenuecat_client() -> RevenueCatClient | None:
    if not settings.revenuecat_secret_api_key:
        return None
    return RevenueCatClient(settings.revenuecat_secret_api_key)


def get_webhook_auth() -> str:
    return settings.revenuecat_webhook_auth


def _billing_service(
    db: Session, client: RevenueCatClient | None,
) -> BillingService:
    if client is None:
        raise HTTPException(
            status_code=503, detail="Purchases are not available right now",
        )
    return BillingService(
        BillingRepository(db), client, settings.revenuecat_entitlement_id,
    )


def account_response(user: User, *, billing_available: bool) -> BillingAccountResponse:
    purchase = user.purchase_entitlement
    purchased = purchase is not None and purchase.is_active()
    granted = str(getattr(user, "tier", "")).upper() == PlanTier.PRO.value
    pro = resolve_tier(user) is PlanTier.PRO
    return BillingAccountResponse(
        app_user_id=user.public_id,
        billing_available=billing_available,
        pro=pro,
        source="purchase" if purchased else "grant" if granted else None,
        plan=purchase.plan if purchased else None,
        expires_at=purchase.expires_at if purchased else None,
    )


@router.get("/billing/account", response_model=BillingAccountResponse)
def get_billing_account(
    user: User = Depends(get_current_user),
    client: RevenueCatClient | None = Depends(get_revenuecat_client),
):
    return account_response(user, billing_available=client is not None)


@router.post("/billing/sync", response_model=BillingAccountResponse)
def sync_billing(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    client: RevenueCatClient | None = Depends(get_revenuecat_client),
):
    """Re-check this account's purchase with RevenueCat.

    The request carries no purchase data: whatever the app says, the answer
    comes from RevenueCat's record for this account.
    """
    service = _billing_service(db, client)

    now = time.monotonic()
    last = _last_sync_by_user.get(user.id)
    if last is None or now - last >= SYNC_MIN_INTERVAL_SECONDS:
        _last_sync_by_user[user.id] = now
        try:
            service.sync_user(user)
        except RevenueCatUnavailableError as exc:
            raise HTTPException(
                status_code=502,
                detail="Could not check your purchase. Try again shortly.",
            ) from exc
    return account_response(user, billing_available=True)


def _event_account_ids(event: dict) -> set[str]:
    ids: set[str] = set()
    for key in ("app_user_id", "original_app_user_id"):
        value = event.get(key)
        if isinstance(value, str):
            ids.add(value)
    for key in ("aliases", "transferred_from", "transferred_to"):
        values = event.get(key)
        if isinstance(values, list):
            ids.update(value for value in values if isinstance(value, str))
    return ids


@router.post("/billing/revenuecat/webhook")
async def revenuecat_webhook(
    request: Request,
    db: Session = Depends(get_db),
    client: RevenueCatClient | None = Depends(get_revenuecat_client),
    expected_auth: str = Depends(get_webhook_auth),
):
    """RevenueCat notification. It only says which accounts to re-check."""
    provided = request.headers.get("Authorization", "")
    if (
        client is None
        or not expected_auth
        or not hmac.compare_digest(
            provided.encode("utf-8"), expected_auth.encode("utf-8"),
        )
    ):
        raise HTTPException(status_code=401, detail="Not authorised")

    try:
        payload = await request.json()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid body") from exc
    event = payload.get("event") if isinstance(payload, dict) else None
    if not isinstance(event, dict):
        raise HTTPException(status_code=400, detail="Invalid body")

    if event.get("type") == "TEST":
        return {"ok": True, "checked": 0}

    # A tip unlocks nothing, so its notifications need no purchase check.
    if event.get("product_id") in TIP_PRODUCT_IDS:
        return {"ok": True, "checked": 0}

    service = _billing_service(db, client)
    reversal = (
        event.get("type") == "CANCELLATION"
        and event.get("cancel_reason") in REVERSAL_CANCEL_REASONS
    )
    users = BillingRepository(db).users_by_public_ids(_event_account_ids(event))
    try:
        for user in users:
            service.sync_user(user, reversal_hint=reversal)
    except RevenueCatUnavailableError as exc:
        # A non-2xx answer makes RevenueCat retry the notification.
        raise HTTPException(status_code=502, detail="Check failed") from exc
    return {"ok": True, "checked": len(users)}
