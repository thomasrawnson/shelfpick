"""Verify Pro purchases with RevenueCat and record them on the account.

The server never accepts a purchase claim from the app or from a webhook body.
Every change starts from RevenueCat's own subscriber record, fetched with the
server-side secret key, so a forged request can at most cause a lookup.
"""

from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

from database.models import PurchaseEntitlement, User
from repositories.billing_repository import BillingRepository


REVENUECAT_API_URL = "https://api.revenuecat.com/v1"
REVENUECAT_TIMEOUT_SECONDS = 8.0

# Webhook events that mean "this purchase may have been reversed".
REVERSAL_CANCEL_REASONS = frozenset({"CUSTOMER_SUPPORT"})


class RevenueCatUnavailableError(Exception):
    """RevenueCat could not be reached or returned something unusable."""


@dataclass(frozen=True)
class VerifiedPurchase:
    product_id: str
    store: str | None
    environment: str
    expires_at: datetime | None
    refunded: bool

    @property
    def plan(self) -> str:
        return "LIFETIME" if self.expires_at is None else "YEARLY"

    def is_active(self, now: datetime) -> bool:
        if self.refunded:
            return False
        return self.expires_at is None or self.expires_at > now


class RevenueCatClient:
    def __init__(
        self,
        secret_api_key: str,
        *,
        base_url: str = REVENUECAT_API_URL,
        timeout: float = REVENUECAT_TIMEOUT_SECONDS,
    ):
        self._secret_api_key = secret_api_key
        self._base_url = base_url
        self._timeout = timeout

    def fetch_subscriber(self, app_user_id: str) -> dict:
        try:
            response = httpx.get(
                f"{self._base_url}/subscribers/{app_user_id}",
                headers={"Authorization": f"Bearer {self._secret_api_key}"},
                timeout=self._timeout,
            )
        except httpx.HTTPError as exc:
            raise RevenueCatUnavailableError(
                "RevenueCat could not be reached"
            ) from exc
        if response.status_code == 404:
            return {}
        if response.status_code != 200:
            raise RevenueCatUnavailableError(
                f"RevenueCat answered {response.status_code}"
            )
        try:
            subscriber = response.json().get("subscriber", {})
        except ValueError as exc:
            raise RevenueCatUnavailableError(
                "RevenueCat sent an unreadable answer"
            ) from exc
        return subscriber if isinstance(subscriber, dict) else {}

    def delete_customer(self, app_user_id: str) -> None:
        """Erase the customer's record at RevenueCat (queued on their side).

        A 404 means there is nothing to erase. It does not cancel an Apple
        subscription; that stays with the user.
        """
        try:
            response = httpx.delete(
                f"{self._base_url}/subscribers/{app_user_id}",
                headers={"Authorization": f"Bearer {self._secret_api_key}"},
                timeout=self._timeout,
            )
        except httpx.HTTPError as exc:
            raise RevenueCatUnavailableError(
                "RevenueCat could not be reached"
            ) from exc
        if response.status_code not in (200, 404):
            raise RevenueCatUnavailableError(
                f"RevenueCat answered {response.status_code}"
            )


def _parse_time(value) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def verified_purchase_from_subscriber(
    subscriber: dict, entitlement_id: str,
) -> VerifiedPurchase | None:
    """The account's Pro purchase according to RevenueCat, or None."""
    entitlement = (subscriber.get("entitlements") or {}).get(entitlement_id)
    if not isinstance(entitlement, dict):
        return None

    product_id = str(entitlement.get("product_identifier") or "")
    if not product_id:
        return None

    expires_at = _parse_time(entitlement.get("expires_date"))
    grace_until = _parse_time(entitlement.get("grace_period_expires_date"))
    if expires_at is not None and grace_until is not None:
        expires_at = max(expires_at, grace_until)

    subscription = (subscriber.get("subscriptions") or {}).get(product_id)
    purchases = (subscriber.get("non_subscriptions") or {}).get(product_id)
    detail = subscription if isinstance(subscription, dict) else (
        purchases[-1] if isinstance(purchases, list) and purchases
        and isinstance(purchases[-1], dict) else {}
    )

    return VerifiedPurchase(
        product_id=product_id,
        store=detail.get("store") if isinstance(detail.get("store"), str) else None,
        environment="SANDBOX" if detail.get("is_sandbox") else "PRODUCTION",
        expires_at=expires_at,
        refunded=bool(
            isinstance(subscription, dict) and subscription.get("refunded_at")
        ),
    )


class BillingService:
    def __init__(
        self,
        repository: BillingRepository,
        client: RevenueCatClient,
        entitlement_id: str,
    ):
        self.repository = repository
        self.client = client
        self.entitlement_id = entitlement_id

    def sync_user(
        self, user: User, *, reversal_hint: bool = False,
    ) -> PurchaseEntitlement | None:
        """Bring the account's purchase record in line with RevenueCat.

        A lookup failure raises and leaves the record untouched: the server
        neither grants nor removes Pro on a failed check.
        """
        now = datetime.now(timezone.utc)
        subscriber = self.client.fetch_subscriber(user.public_id)
        purchase = verified_purchase_from_subscriber(
            subscriber, self.entitlement_id,
        )

        if purchase is not None and purchase.is_active(now):
            return self.repository.save_verified(
                user,
                status="ACTIVE",
                plan=purchase.plan,
                product_id=purchase.product_id,
                store=purchase.store,
                environment=purchase.environment,
                expires_at=purchase.expires_at,
                now=now,
            )

        if purchase is None:
            ended = "REVOKED" if reversal_hint else "EXPIRED"
            return self.repository.mark_ended(user, status=ended, now=now)

        return self.repository.save_verified(
            user,
            status="REVOKED" if purchase.refunded else "EXPIRED",
            plan=purchase.plan,
            product_id=purchase.product_id,
            store=purchase.store,
            environment=purchase.environment,
            expires_at=purchase.expires_at,
            now=now,
        )
