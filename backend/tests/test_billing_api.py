"""Server-side Pro purchases: verification, lapse, refund, restore and forgery."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from api.current_user import get_current_user
from api.main import app
from api.routers import billing
from api.routers.billing import get_revenuecat_client, get_webhook_auth
from auth.security import hash_password
from database.connection import Base, get_db
from database.models import (
    PurchaseEntitlement,
    Scoresheet,
    ScoresheetVersion,
    User,
)
from services.account_service import AccountService
from services.billing_service import RevenueCatUnavailableError


LIFETIME = "com.plutonightlabs.shelfpick.pro.lifetime"
YEARLY = "com.plutonightlabs.shelfpick.pro.yearly"
WEBHOOK_AUTH = "Bearer webhook-secret-for-tests"
PRO_ONLY_URL = "/scoresheets/mine"


def iso(moment):
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


class FakeRevenueCat:
    """RevenueCat's side: what it says about each app user ID."""

    def __init__(self):
        self.subscribers: dict[str, dict] = {}
        self.fail = False
        self.lookups: list[str] = []
        self.deleted: list[str] = []

    def delete_customer(self, app_user_id):
        if self.fail:
            raise RevenueCatUnavailableError("down")
        self.deleted.append(app_user_id)
        self.subscribers.pop(app_user_id, None)

    def fetch_subscriber(self, app_user_id):
        self.lookups.append(app_user_id)
        if self.fail:
            raise RevenueCatUnavailableError("down")
        return self.subscribers.get(app_user_id, {})

    def lifetime(self, app_user_id, *, sandbox=True):
        self.subscribers[app_user_id] = {
            "entitlements": {"pro": {
                "product_identifier": LIFETIME, "expires_date": None,
            }},
            "non_subscriptions": {
                LIFETIME: [{"store": "app_store", "is_sandbox": sandbox}],
            },
        }

    def yearly(self, app_user_id, expires, *, refunded_at=None):
        self.subscribers[app_user_id] = {
            "entitlements": {"pro": {
                "product_identifier": YEARLY, "expires_date": iso(expires),
            }},
            "subscriptions": {YEARLY: {
                "store": "app_store", "is_sandbox": True,
                "refunded_at": refunded_at,
            }},
        }

    def clear(self, app_user_id):
        self.subscribers.pop(app_user_id, None)


@pytest.fixture()
def billing_api():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Session = sessionmaker(bind=engine)
    Base.metadata.create_all(engine)
    with Session() as seed:
        seed.add_all([
            User(id=1, email="a@example.com", tier="FREE",
                 password_hash=hash_password("correct horse")),
            User(id=2, email="b@example.com", tier="FREE"),
            User(id=3, email="granted@example.com", tier="PRO"),
        ])
        seed.commit()

    revenuecat = FakeRevenueCat()
    current = {"id": 1}
    billing._last_sync_by_user.clear()

    def override_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    def override_user(db=Depends(get_db)):
        return db.get(User, current["id"])

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_revenuecat_client] = lambda: revenuecat
    app.dependency_overrides[get_webhook_auth] = lambda: WEBHOOK_AUTH

    def app_user_id(user_id):
        with Session() as db:
            return db.get(User, user_id).public_id

    def entitlement(user_id):
        with Session() as db:
            return db.scalars(select(PurchaseEntitlement).where(
                PurchaseEntitlement.user_id == user_id)).one_or_none()

    def webhook(event, auth=WEBHOOK_AUTH):
        headers = {"Authorization": auth} if auth is not None else {}
        return client.post("/billing/revenuecat/webhook",
                           json={"event": event}, headers=headers)

    try:
        with TestClient(app) as client:
            billing_api = type("Api", (), {})()
            billing_api.client = client
            billing_api.Session = Session
            billing_api.revenuecat = revenuecat
            billing_api.current = current
            billing_api.app_user_id = staticmethod(app_user_id)
            billing_api.entitlement = staticmethod(entitlement)
            billing_api.webhook = staticmethod(webhook)

            def is_pro_gate_open():
                return client.get(PRO_ONLY_URL).status_code == 200

            billing_api.pro_gate_open = staticmethod(is_pro_gate_open)
            yield billing_api
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()
        billing._last_sync_by_user.clear()


def sync(api):
    billing._last_sync_by_user.clear()
    return api.client.post("/billing/sync")


def test_account_has_a_public_id_that_is_not_its_email_or_numeric_id(billing_api):
    body = billing_api.client.get("/billing/account").json()

    assert len(body["app_user_id"]) == 36
    assert "example.com" not in body["app_user_id"]
    assert body["pro"] is False
    assert body["source"] is None
    assert body["billing_available"] is True
    assert billing_api.pro_gate_open() is False


def test_lifetime_purchase_is_verified_and_unlocks_pro(billing_api):
    api = billing_api
    api.revenuecat.lifetime(api.app_user_id(1))

    body = sync(api).json()

    assert body["pro"] is True
    assert body["source"] == "purchase"
    assert body["plan"] == "LIFETIME"
    assert body["expires_at"] is None
    saved = api.entitlement(1)
    assert saved.status == "ACTIVE"
    assert saved.environment == "SANDBOX"
    assert saved.product_id == LIFETIME
    assert api.pro_gate_open() is True


def test_yearly_purchase_unlocks_pro_until_it_expires(billing_api):
    api = billing_api
    api.revenuecat.yearly(
        api.app_user_id(1), datetime.now(timezone.utc) + timedelta(days=365))

    body = sync(api).json()

    assert body["pro"] is True
    assert body["plan"] == "YEARLY"
    assert body["expires_at"] is not None
    assert api.pro_gate_open() is True


def test_yearly_expiry_downgrades_the_account_and_gates_close(billing_api):
    api = billing_api
    api.revenuecat.yearly(
        api.app_user_id(1), datetime.now(timezone.utc) + timedelta(days=30))
    sync(api)
    assert api.pro_gate_open() is True

    # The plan lapses and RevenueCat reports the entitlement as expired.
    api.revenuecat.yearly(
        api.app_user_id(1), datetime.now(timezone.utc) - timedelta(minutes=1))
    api.webhook({"type": "EXPIRATION", "app_user_id": api.app_user_id(1)})

    assert api.entitlement(1).status == "EXPIRED"
    assert api.client.get("/billing/account").json()["pro"] is False
    assert api.pro_gate_open() is False


def test_expired_date_downgrades_even_before_any_notification_arrives(billing_api):
    api = billing_api
    with api.Session() as db:
        db.add(PurchaseEntitlement(
            user_id=1, status="ACTIVE", plan="YEARLY", product_id=YEARLY,
            environment="SANDBOX",
            expires_at=datetime.now(timezone.utc) - timedelta(seconds=5),
            last_synced_at=datetime.now(timezone.utc),
        ))
        db.commit()

    assert api.client.get("/billing/account").json()["pro"] is False
    assert api.pro_gate_open() is False


def test_refund_revokes_pro(billing_api):
    api = billing_api
    api.revenuecat.lifetime(api.app_user_id(1))
    sync(api)
    assert api.pro_gate_open() is True

    api.revenuecat.clear(api.app_user_id(1))
    response = api.webhook({
        "type": "CANCELLATION", "cancel_reason": "CUSTOMER_SUPPORT",
        "app_user_id": api.app_user_id(1),
    })

    assert response.status_code == 200
    assert api.entitlement(1).status == "REVOKED"
    assert api.pro_gate_open() is False


def test_refunded_subscription_is_revoked_even_though_its_period_has_not_ended(billing_api):
    api = billing_api
    api.revenuecat.yearly(
        api.app_user_id(1), datetime.now(timezone.utc) + timedelta(days=300),
        refunded_at=iso(datetime.now(timezone.utc)))

    body = sync(api).json()

    assert body["pro"] is False
    assert api.entitlement(1).status == "REVOKED"
    assert api.pro_gate_open() is False


def test_restore_on_a_second_device_returns_the_same_account_to_pro(billing_api):
    api = billing_api
    api.revenuecat.lifetime(api.app_user_id(1))
    sync(api)

    # A fresh install signs in to the same account and asks for a check.
    with api.Session() as db:
        db.query(PurchaseEntitlement).delete()
        db.commit()
    assert api.pro_gate_open() is False

    body = sync(api).json()

    assert body["pro"] is True
    assert api.pro_gate_open() is True


def test_purchase_moves_with_a_revenuecat_transfer_between_accounts(billing_api):
    api = billing_api
    first, second = api.app_user_id(1), api.app_user_id(2)
    api.revenuecat.lifetime(first)
    sync(api)

    api.revenuecat.clear(first)
    api.revenuecat.lifetime(second)
    api.webhook({
        "type": "TRANSFER", "transferred_from": [first], "transferred_to": [second],
    })

    assert api.entitlement(1).status == "EXPIRED"
    assert api.entitlement(2).status == "ACTIVE"
    api.current["id"] = 2
    assert api.pro_gate_open() is True
    api.current["id"] = 1
    assert api.pro_gate_open() is False


def test_lapse_then_restore_regates_correctly(billing_api):
    api = billing_api
    me = api.app_user_id(1)
    api.revenuecat.yearly(me, datetime.now(timezone.utc) + timedelta(days=10))
    sync(api)
    api.revenuecat.yearly(me, datetime.now(timezone.utc) - timedelta(days=1))
    sync(api)
    assert api.pro_gate_open() is False

    api.revenuecat.lifetime(me)
    sync(api)

    assert api.pro_gate_open() is True
    assert api.entitlement(1).plan == "LIFETIME"


def test_data_made_with_pro_stays_readable_after_a_lapse(billing_api):
    api = billing_api
    me = api.app_user_id(1)
    api.revenuecat.lifetime(me)
    sync(api)
    schema = {"bgg_id": 555, "format_version": 1, "name": "House rules"}
    with api.Session() as db:
        sheet = Scoresheet(
            bgg_game_id=555, owner_user_id=1, schema=schema,
            format_version=1, version=1,
        )
        db.add(sheet)
        db.flush()
        db.add(ScoresheetVersion(
            scoresheet_id=sheet.id, version=1, schema=schema, format_version=1,
        ))
        db.commit()
        sheet_id = sheet.id
    assert api.client.get(f"/scoresheets/{sheet_id}").status_code == 200

    api.revenuecat.clear(me)
    sync(api)

    # The builder is locked again, but the sheet and its data are still there.
    assert api.client.get(PRO_ONLY_URL).status_code == 403
    assert api.client.post("/scoresheets", json={"schema": schema}).status_code == 403
    kept = api.client.get(f"/scoresheets/{sheet_id}")
    assert kept.status_code == 200
    assert kept.json()["schema"]["name"] == "House rules"


# --- Forgery -----------------------------------------------------------------

def test_client_claims_in_the_request_cannot_grant_pro(billing_api):
    api = billing_api
    forged = {
        "tier": "PRO", "pro": True, "plan": "LIFETIME", "status": "ACTIVE",
        "product_id": LIFETIME, "expires_at": None, "user_id": 1,
        "entitlements": {"pro": {"product_identifier": LIFETIME}},
    }
    billing._last_sync_by_user.clear()

    response = api.client.post("/billing/sync", json=forged)

    assert response.status_code == 200
    assert response.json()["pro"] is False
    assert api.entitlement(1) is None
    assert api.pro_gate_open() is False
    with api.Session() as db:
        assert db.get(User, 1).tier == "FREE"


def test_no_other_endpoint_lets_a_user_set_their_own_tier(billing_api):
    api = billing_api
    for method, url, body in (
        ("put", "/profile", {"tier": "PRO", "display_name": "x"}),
        ("patch", "/profile", {"tier": "PRO"}),
        ("post", "/billing/account", {"tier": "PRO"}),
        ("put", "/billing/account", {"tier": "PRO"}),
    ):
        getattr(api.client, method)(url, json=body)

    assert api.entitlement(1) is None
    with api.Session() as db:
        assert db.get(User, 1).tier == "FREE"
    assert api.pro_gate_open() is False


def test_sync_requires_a_signed_in_account(billing_api):
    app.dependency_overrides.pop(get_current_user)

    response = billing_api.client.post("/billing/sync")

    assert response.status_code == 401
    assert billing_api.revenuecat.lookups == []


@pytest.mark.parametrize("auth", [None, "", "wrong", "Bearer wrong",
                                  "bearer webhook-secret-for-tests"])
def test_webhook_without_the_shared_secret_does_nothing(billing_api, auth):
    api = billing_api
    me = api.app_user_id(1)
    api.revenuecat.lifetime(me)

    response = api.webhook(
        {"type": "INITIAL_PURCHASE", "app_user_id": me}, auth=auth)

    assert response.status_code == 401
    assert api.entitlement(1) is None
    assert api.revenuecat.lookups == []


def test_forged_webhook_with_the_secret_still_only_triggers_a_lookup(billing_api):
    api = billing_api
    me = api.app_user_id(1)
    # RevenueCat has no purchase for this account; the body claims one.
    response = api.webhook({
        "type": "INITIAL_PURCHASE", "app_user_id": me,
        "product_id": LIFETIME, "entitlement_ids": ["pro"],
        "expiration_at_ms": 4102444800000,
    })

    assert response.status_code == 200
    assert api.revenuecat.lookups == [me]
    assert api.entitlement(1) is None
    assert api.pro_gate_open() is False


def test_webhook_for_an_unknown_account_is_ignored(billing_api):
    response = billing_api.webhook(
        {"type": "INITIAL_PURCHASE", "app_user_id": "not-a-real-account"})

    assert response.status_code == 200
    assert response.json()["checked"] == 0
    assert billing_api.revenuecat.lookups == []


def test_webhook_test_event_checks_nothing(billing_api):
    response = billing_api.webhook({"type": "TEST"})

    assert response.status_code == 200
    assert billing_api.revenuecat.lookups == []


def test_webhook_rejects_malformed_bodies(billing_api):
    client = billing_api.client
    headers = {"Authorization": WEBHOOK_AUTH}

    assert client.post("/billing/revenuecat/webhook", content="not json",
                       headers=headers).status_code == 400
    assert client.post("/billing/revenuecat/webhook", json=[1],
                       headers=headers).status_code == 400
    assert client.post("/billing/revenuecat/webhook", json={"event": "x"},
                       headers=headers).status_code == 400


# --- Failure and manual grants ----------------------------------------------

def test_failed_check_grants_nothing_and_removes_nothing(billing_api):
    api = billing_api
    me = api.app_user_id(1)
    api.revenuecat.fail = True

    assert sync(api).status_code == 502
    assert api.entitlement(1) is None

    api.revenuecat.fail = False
    api.revenuecat.lifetime(me)
    sync(api)
    api.revenuecat.fail = True

    assert sync(api).status_code == 502
    assert api.entitlement(1).status == "ACTIVE"
    assert api.webhook({"type": "RENEWAL", "app_user_id": me}).status_code == 502
    assert api.entitlement(1).status == "ACTIVE"


def test_manual_pro_grant_keeps_working_and_is_never_overwritten(billing_api):
    api = billing_api
    api.current["id"] = 3

    assert api.pro_gate_open() is True
    body = sync(api).json()

    assert body["pro"] is True
    assert body["source"] == "grant"
    assert api.entitlement(3) is None
    with api.Session() as db:
        assert db.get(User, 3).tier == "PRO"

    api.webhook({"type": "EXPIRATION", "app_user_id": api.app_user_id(3)})

    assert api.pro_gate_open() is True
    with api.Session() as db:
        assert db.get(User, 3).tier == "PRO"


def test_purchase_and_manual_grant_together_survive_a_refund(billing_api):
    api = billing_api
    api.current["id"] = 3
    me = api.app_user_id(3)
    api.revenuecat.lifetime(me)
    sync(api)
    assert api.client.get("/billing/account").json()["source"] == "purchase"

    api.revenuecat.clear(me)
    api.webhook({"type": "CANCELLATION", "cancel_reason": "CUSTOMER_SUPPORT",
                 "app_user_id": me})

    assert api.entitlement(3).status == "REVOKED"
    assert api.client.get("/billing/account").json()["source"] == "grant"
    assert api.pro_gate_open() is True


def test_billing_is_unavailable_until_revenuecat_is_configured(billing_api):
    api = billing_api
    app.dependency_overrides[get_revenuecat_client] = lambda: None

    assert api.client.get("/billing/account").json()["billing_available"] is False
    assert api.client.post("/billing/sync").status_code == 503
    assert api.webhook({"type": "RENEWAL", "app_user_id": "x"}).status_code == 401


def test_repeat_sync_calls_do_not_hammer_revenuecat(billing_api):
    api = billing_api
    billing._last_sync_by_user.clear()

    api.client.post("/billing/sync")
    api.client.post("/billing/sync")
    api.client.post("/billing/sync")

    assert len(api.revenuecat.lookups) == 1


def test_deleting_an_account_removes_its_purchase_record(billing_api):
    api = billing_api
    api.revenuecat.lifetime(api.app_user_id(1))
    sync(api)
    assert api.entitlement(1) is not None

    with api.Session() as db:
        AccountService(db).delete_account(db.get(User, 1), "correct horse")

    with api.Session() as db:
        assert db.scalars(select(PurchaseEntitlement)).all() == []


def test_deleting_an_account_through_the_route_erases_the_revenuecat_customer(
    billing_api,
):
    api = billing_api
    account_id = api.app_user_id(1)
    api.revenuecat.lifetime(account_id)
    sync(api)

    response = api.client.request(
        "DELETE", "/auth/account", json={"password": "correct horse"},
    )

    assert response.status_code == 200
    assert api.revenuecat.deleted == [account_id]
    assert account_id not in api.revenuecat.subscribers


def test_a_revenuecat_failure_does_not_undo_the_account_deletion(
    billing_api, caplog,
):
    api = billing_api
    account_id = api.app_user_id(1)
    api.revenuecat.fail = True

    with caplog.at_level("WARNING"):
        response = api.client.request(
            "DELETE", "/auth/account", json={"password": "correct horse"},
        )

    assert response.status_code == 200
    with api.Session() as db:
        assert db.get(User, 1) is None
    # The random ID is logged so the record can be removed by hand.
    assert account_id in caplog.text
    assert "a@example.com" not in caplog.text


def test_a_wrong_password_erases_nothing_at_revenuecat(billing_api):
    api = billing_api
    api.revenuecat.lifetime(api.app_user_id(1))

    response = api.client.request(
        "DELETE", "/auth/account", json={"password": "wrong"},
    )

    assert response.status_code == 403
    assert api.revenuecat.deleted == []
    with api.Session() as db:
        assert db.get(User, 1) is not None


def test_account_deletion_works_when_purchases_are_not_configured(billing_api):
    api = billing_api
    app.dependency_overrides[get_revenuecat_client] = lambda: None

    response = api.client.request(
        "DELETE", "/auth/account", json={"password": "correct horse"},
    )

    assert response.status_code == 200
    with api.Session() as db:
        assert db.get(User, 1) is None


def test_tier_and_entitlements_in_the_user_response_follow_purchases(billing_api):
    from api.routers.auth import user_response

    api = billing_api
    api.revenuecat.lifetime(api.app_user_id(1))
    sync(api)

    with api.Session() as db:
        response = user_response(db.get(User, 1))

    assert response.tier == "PRO"
    assert "advanced_stats" in response.entitlements
