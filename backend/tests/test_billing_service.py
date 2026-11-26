from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import httpx
import pytest

from database.models import PurchaseEntitlement
from services.billing_service import (
    TIP_PRODUCT_IDS,
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


YEARLY_PRODUCT = "com.plutonightlabs.shelfpick.pro.yearly"
LIFETIME_PRODUCT = "com.plutonightlabs.shelfpick.pro.lifetime"


def entitlement_with(product, expires, **extra):
    return {"product_identifier": product, "expires_date": expires, **extra}


@pytest.mark.parametrize("expires", [
    "not-a-date", "", "2026-13-45T99:99:99Z", 1790000000, True, ["2027-01-01T00:00:00Z"],
])
def test_subscription_with_a_present_but_unreadable_expiry_is_an_unavailable_check(expires):
    with pytest.raises(RevenueCatUnavailableError):
        verified_purchase_from_subscriber(
            subscriber(
                entitlement_with(YEARLY_PRODUCT, expires),
                subscriptions={YEARLY_PRODUCT: {"store": "app_store"}},
            ),
            "pro",
        )


@pytest.mark.parametrize("expires", ["not-a-date", "", 1790000000])
def test_unreadable_expiry_on_the_lifetime_product_does_not_grant_lifetime(expires):
    with pytest.raises(RevenueCatUnavailableError):
        verified_purchase_from_subscriber(
            subscriber(
                entitlement_with(LIFETIME_PRODUCT, expires),
                non_subscriptions={LIFETIME_PRODUCT: [{"store": "app_store"}]},
            ),
            "pro",
        )


def test_a_missing_expiry_is_not_an_explicit_null():
    with pytest.raises(RevenueCatUnavailableError):
        verified_purchase_from_subscriber(
            subscriber(
                {"product_identifier": LIFETIME_PRODUCT},
                non_subscriptions={LIFETIME_PRODUCT: [{"store": "app_store"}]},
            ),
            "pro",
        )


def test_null_expiry_only_means_lifetime_for_the_one_time_product():
    # A subscription, or a product RevenueCat lists as neither, never becomes perpetual.
    with pytest.raises(RevenueCatUnavailableError):
        verified_purchase_from_subscriber(
            subscriber(
                entitlement_with(YEARLY_PRODUCT, None),
                subscriptions={YEARLY_PRODUCT: {"store": "app_store"}},
            ),
            "pro",
        )
    with pytest.raises(RevenueCatUnavailableError):
        verified_purchase_from_subscriber(
            subscriber(entitlement_with("com.example.unknown", None)), "pro",
        )


def test_unreadable_grace_period_is_an_unavailable_check_not_a_silent_downgrade():
    with pytest.raises(RevenueCatUnavailableError):
        verified_purchase_from_subscriber(
            subscriber(entitlement_with(
                YEARLY_PRODUCT, iso(NOW - timedelta(days=1)),
                grace_period_expires_date="soon",
            )),
            "pro",
        )


def test_unreadable_expiry_is_logged_without_the_account(caplog):
    with caplog.at_level("WARNING", logger="services.billing_service"):
        with pytest.raises(RevenueCatUnavailableError):
            verified_purchase_from_subscriber(
                subscriber(entitlement_with(YEARLY_PRODUCT, "garbage")), "pro",
            )
    assert YEARLY_PRODUCT in caplog.text
    assert "unreadable expiry" in caplog.text


def test_valid_expiry_and_explicit_null_lifetime_are_unchanged():
    expiry = NOW + timedelta(days=30)
    yearly = verified_purchase_from_subscriber(
        subscriber(entitlement_with(YEARLY_PRODUCT, iso(expiry)),
                   subscriptions={YEARLY_PRODUCT: {"store": "app_store"}}),
        "pro",
    )
    assert yearly.plan == "YEARLY" and yearly.expires_at == expiry
    lifetime = verified_purchase_from_subscriber(
        subscriber(entitlement_with(LIFETIME_PRODUCT, None),
                   non_subscriptions={LIFETIME_PRODUCT: [{"store": "app_store"}]}),
        "pro",
    )
    assert lifetime.plan == "LIFETIME" and lifetime.expires_at is None


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


def test_client_deletes_the_customer_with_the_server_secret(monkeypatch):
    seen = {}

    def fake_delete(url, headers, timeout):
        seen.update(url=url, headers=headers)
        return httpx.Response(200, json={"deleted": True},
                              request=httpx.Request("DELETE", url))

    monkeypatch.setattr(httpx, "delete", fake_delete)

    RevenueCatClient("sk_test_not_real").delete_customer("abc-123")

    assert seen["url"].endswith("/subscribers/abc-123")
    assert seen["headers"]["Authorization"] == "Bearer sk_test_not_real"


def test_deleting_an_unknown_customer_counts_as_done(monkeypatch):
    monkeypatch.setattr(
        httpx, "delete",
        lambda url, headers, timeout: httpx.Response(
            404, request=httpx.Request("DELETE", url)),
    )

    RevenueCatClient("sk").delete_customer("abc")


@pytest.mark.parametrize("status", [401, 403, 429, 500])
def test_a_refused_or_failed_delete_is_reported(monkeypatch, status):
    monkeypatch.setattr(
        httpx, "delete",
        lambda url, headers, timeout: httpx.Response(
            status, request=httpx.Request("DELETE", url)),
    )

    with pytest.raises(RevenueCatUnavailableError):
        RevenueCatClient("sk").delete_customer("abc")


def test_a_network_failure_on_delete_is_reported(monkeypatch):
    def boom(url, headers, timeout):
        raise httpx.ConnectTimeout("slow")

    monkeypatch.setattr(httpx, "delete", boom)

    with pytest.raises(RevenueCatUnavailableError):
        RevenueCatClient("sk").delete_customer("abc")


# --- Tips never grant Pro ---------------------------------------------------------

TIP_COFFEE = "tip.coffee"


def test_tip_product_ids_match_the_app():
    import re
    from pathlib import Path

    source = (Path(__file__).resolve().parents[2] / "frontend/src/tip-jar.ts").read_text()
    app_ids = set(re.findall(r'id: "(com\.plutonightlabs\.shelfpick\.tip\.[a-z]+)"', source))
    assert app_ids == set(TIP_PRODUCT_IDS) and len(app_ids) == 3


@pytest.mark.parametrize("product", sorted(TIP_PRODUCT_IDS))
def test_a_tip_attached_to_the_entitlement_is_ignored_despite_having_no_expiry(product):
    # Same shape as Pro Lifetime: a one-time product with an explicit null expiry.
    assert verified_purchase_from_subscriber(
        subscriber(
            entitlement_with(product, None),
            non_subscriptions={product: [{"store": "app_store", "is_sandbox": False}]},
        ),
        "pro",
    ) is None


def test_an_unreadable_tip_expiry_is_ignored_not_an_unavailable_check():
    assert verified_purchase_from_subscriber(
        subscriber(entitlement_with(TIP_COFFEE, "garbage")), "pro",
    ) is None


def test_tips_alongside_a_real_pro_purchase_leave_the_pro_result_unchanged():
    expiry = NOW + timedelta(days=30)
    with_tips = verified_purchase_from_subscriber(
        subscriber(
            entitlement_with(YEARLY_PRODUCT, iso(expiry)),
            subscriptions={YEARLY_PRODUCT: {"store": "app_store"}},
            non_subscriptions={product: [{"store": "app_store"}] for product in TIP_PRODUCT_IDS},
        ),
        "pro",
    )
    without = verified_purchase_from_subscriber(
        subscriber(
            entitlement_with(YEARLY_PRODUCT, iso(expiry)),
            subscriptions={YEARLY_PRODUCT: {"store": "app_store"}},
        ),
        "pro",
    )
    assert with_tips == without and with_tips.plan == "YEARLY"

    lifetime = verified_purchase_from_subscriber(
        subscriber(
            entitlement_with(LIFETIME_PRODUCT, None),
            non_subscriptions={
                LIFETIME_PRODUCT: [{"store": "app_store"}],
                TIP_COFFEE: [{"store": "app_store"}, {"store": "app_store"}],
            },
        ),
        "pro",
    )
    assert lifetime.plan == "LIFETIME" and lifetime.product_id == LIFETIME_PRODUCT
