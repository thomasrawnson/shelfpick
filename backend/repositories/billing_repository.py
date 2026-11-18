from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from database.models import PurchaseEntitlement, User


class BillingRepository:
    def __init__(self, db: Session):
        self.db = db

    def users_by_public_ids(self, public_ids: set[str]) -> list[User]:
        if not public_ids:
            return []
        return list(
            self.db.scalars(
                select(User).where(User.public_id.in_(public_ids))
            )
        )

    def save_verified(
        self,
        user: User,
        *,
        status: str,
        plan: str,
        product_id: str,
        store: str | None,
        environment: str,
        expires_at: datetime | None,
        now: datetime,
    ) -> PurchaseEntitlement:
        entitlement = user.purchase_entitlement
        if entitlement is None:
            entitlement = PurchaseEntitlement(user_id=user.id, created_at=now)
            user.purchase_entitlement = entitlement
        entitlement.status = status
        entitlement.plan = plan
        entitlement.product_id = product_id
        entitlement.store = store
        entitlement.environment = environment
        entitlement.expires_at = expires_at
        entitlement.last_synced_at = now
        entitlement.updated_at = now
        self.db.commit()
        return entitlement

    def mark_ended(
        self, user: User, *, status: str, now: datetime,
    ) -> PurchaseEntitlement | None:
        """End a purchase that RevenueCat no longer reports as active."""
        entitlement = user.purchase_entitlement
        if entitlement is None:
            return None
        entitlement.status = status
        entitlement.last_synced_at = now
        entitlement.updated_at = now
        self.db.commit()
        return entitlement

    def touch_synced(
        self, entitlement: PurchaseEntitlement, *, now: datetime,
    ) -> None:
        entitlement.last_synced_at = now
        self.db.commit()
