from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import httpx
import pytest

from database.models import PurchaseEntitlement
from services.billing_service import (
    RevenueCatClient,
    RevenueCatUnavailableError,
    verified_purchase_from_subscriber,
)
from services.entitlements import Feature, PlanTier, can_use, resolve_tier


NOW = datetime(2026, 11, 18, 12, 0, tzinfo=timezone.utc)


def iso(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def subscriber(entitlement=None, subscriptions=None, non_subscriptions=None):
    return {
        "entitlements": {"pro": entitlement} if entitlement else {},
        "subscriptions": subscriptions or {},
        "non_subscriptions": non_subscriptions or {},
    }


def test_lifetime_purchase_has_no_expiry():
    purchase = verified_purchase_from_subscriber(
        subscriber(
            {"product_identifier": "com.plutonightlabs.shelfpick.pro.lifetime",
             "expires_date": None},
            non_subscriptions={
                "com.plutonightlabs.shelfpick.pro.lifetime": [
                    {"store": "app_store", "is_sandbox": False},
                ],
            },
        ),
        "pro",
    )

    assert purchase.plan == "LIFETIME"
    assert purchase.expires_at is None
    assert purchase.environment == "PRODUCTION"
    assert purchase.store == "app_store"
    assert purchase.is_active(NOW)


def test_yearly_purchase_is_active_until_it_expires_and_records_sandbox():
    product = "com.plutonightlabs.shelfpick.pro.yearly"
    expiry = NOW + timedelta(days=100)
    purchase = verified_purchase_from_subscriber(
        subscriber(
            {"product_identifier": product, "expires_date": iso(expiry)},
            subscriptions={product: {"store": "app_store", "is_sandbox": True}},
        ),
        "pro",
    )

    assert purchase.plan == "YEARLY"
    assert purchase.environment == "SANDBOX"
    assert purchase.is_active(NOW)
    assert not purchase.is_active(expiry + timedelta(seconds=1))


def test_billing_grace_period_keeps_pro_until_it_ends():
    product = "com.plutonightlabs.shelfpick.pro.yearly"
    purchase = verified_purchase_from_subscriber(
        subscriber({
            "product_identifier": product,
            "expires_date": iso(NOW - timedelta(days=1)),
            "grace_period_expires_date": iso(NOW + timedelta(days=5)),
        }),
        "pro",
    )

    assert purchase.is_active(NOW)


def test_refunded_subscription_is_not_active_even_before_its_expiry():
    product = "com.plutonightlabs.shelfpick.pro.yearly"
    purchase = verified_purchase_from_subscriber(
        subscriber(
            {"product_identifier": product,
             "expires_date": iso(NOW + timedelta(days=200))},
            subscriptions={product: {"refunded_at": iso(NOW)}},
        ),
        "pro",
    )

    assert purchase.refunded
    assert not purchase.is_active(NOW)


@pytest.mark.parametrize("payload", [
    {},
    {"entitlements": None},
    {"entitlements": {"other": {"product_identifier": "x", "expires_date": None}}},
    {"entitlements": {"pro": {"expires_date": None}}},
    {"entitlements": {"pro": "yes"}},
])
def test_no_pro_entitlement_means_no_purchase(payload):
    assert verified_purchase_from_subscriber(payload, "pro") is None


def test_purchase_row_expiry_is_judged_against_the_clock():
    user = SimpleNamespace(
        tier="FREE",
        purchase_entitlement=PurchaseEntitlement(
            status="ACTIVE", plan="YEARLY", product_id="p",
            environment="PRODUCTION",
            expires_at=datetime.now(timezone.utc) - timedelta(seconds=1),
        ),
    )

    assert resolve_tier(user) is PlanTier.FREE
    assert not can_use(user, Feature.ADVANCED_STATS)


@pytest.mark.parametrize("status", ["EXPIRED", "REVOKED"])
def test_ended_purchase_never_unlocks_pro(status):
    user = SimpleNamespace(
        tier="FREE",
        purchase_entitlement=PurchaseEntitlement(
            status=status, plan="LIFETIME", product_id="p",
            environment="PRODUCTION", expires_at=None,
        ),
    )

    assert resolve_tier(user) is PlanTier.FREE


def test_active_lifetime_and_unexpired_yearly_unlock_every_pro_feature():
    lifetime = SimpleNamespace(tier="FREE", purchase_entitlement=PurchaseEntitlement(
        status="ACTIVE", plan="LIFETIME", product_id="p",
        environment="PRODUCTION", expires_at=None,
    ))
    yearly = SimpleNamespace(tier="FREE", purchase_entitlement=PurchaseEntitlement(
        status="ACTIVE", plan="YEARLY", product_id="p", environment="PRODUCTION",
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    ))

    for user in (lifetime, yearly):
        assert resolve_tier(user) is PlanTier.PRO
        assert all(can_use(user, feature) for feature in Feature)


def test_manual_pro_grant_survives_an_ended_purchase():
    user = SimpleNamespace(
        tier="PRO",
        purchase_entitlement=PurchaseEntitlement(
            status="REVOKED", plan="YEARLY", product_id="p",
            environment="PRODUCTION", expires_at=None,
        ),
    )

    assert resolve_tier(user) is PlanTier.PRO


def test_client_sends_the_server_secret_and_reads_the_subscriber(monkeypatch):
    seen = {}

    def fake_get(url, headers, timeout):
        seen.update(url=url, headers=headers)
        return httpx.Response(200, json={"subscriber": {"entitlements": {}}},
                              request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx, "get", fake_get)

    result = RevenueCatClient("sk_test_not_real").fetch_subscriber("abc-123")

    assert result == {"entitlements": {}}
    assert seen["url"].endswith("/subscribers/abc-123")
    assert seen["headers"]["Authorization"] == "Bearer sk_test_not_real"


@pytest.mark.parametrize("status", [401, 429, 500])
def test_client_reports_unusable_answers_as_unavailable(monkeypatch, status):
    monkeypatch.setattr(
        httpx, "get",
        lambda url, headers, timeout: httpx.Response(
            status, request=httpx.Request("GET", url)),
    )

    with pytest.raises(RevenueCatUnavailableError):
        RevenueCatClient("sk").fetch_subscriber("abc")


def test_client_reports_a_network_failure_as_unavailable(monkeypatch):
    def boom(url, headers, timeout):
        raise httpx.ConnectTimeout("slow")

    monkeypatch.setattr(httpx, "get", boom)

    with pytest.raises(RevenueCatUnavailableError):
        RevenueCatClient("sk").fetch_subscriber("abc")


def test_unknown_subscriber_reads_as_empty(monkeypatch):
    monkeypatch.setattr(
        httpx, "get",
        lambda url, headers, timeout: httpx.Response(
            404, request=httpx.Request("GET", url)),
    )

    assert RevenueCatClient("sk").fetch_subscriber("abc") == {}
