from datetime import datetime, timedelta, timezone
import secrets

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database.models import OperationLeaseSlot, UserOperationLease


class OperationCooldownError(RuntimeError):
    pass


class OperationInProgressError(RuntimeError):
    pass


class OperationCapacityError(RuntimeError):
    pass


class GlobalOperationGuard:
    SLOT_LIMITS = {"collection-sync": 2}

    def __init__(
        self,
        db: Session,
        user_id: int,
        operation: str,
        lease_seconds: int,
    ):
        self.db = db
        self.user_id = user_id
        self.operation = operation
        self.lease_seconds = lease_seconds
        self.slot: int | None = None
        self.lease_token: str | None = None

    def acquire(self) -> None:
        self._ensure_slots()
        now = datetime.now(timezone.utc)
        row = (
            self.db.query(OperationLeaseSlot)
            .filter(
                OperationLeaseSlot.operation == self.operation,
                OperationLeaseSlot.lease_expires_at <= now,
            )
            .order_by(OperationLeaseSlot.slot)
            .with_for_update(skip_locked=True)
            .first()
        )
        if row is None:
            self.db.rollback()
            raise OperationCapacityError(
                "Collection sync is busy. Please try again shortly."
            )
        row.owner_user_id = self.user_id
        row.lease_expires_at = now + timedelta(seconds=self.lease_seconds)
        row.lease_token = secrets.token_urlsafe(24)
        self.slot = row.slot
        self.lease_token = row.lease_token
        self.db.commit()

    def renew(self) -> None:
        if self.slot is None or self.lease_token is None:
            raise OperationInProgressError("Collection sync lease was lost.")
        row = (
            self.db.query(OperationLeaseSlot)
            .filter(
                OperationLeaseSlot.operation == self.operation,
                OperationLeaseSlot.slot == self.slot,
                OperationLeaseSlot.owner_user_id == self.user_id,
                OperationLeaseSlot.lease_token == self.lease_token,
            )
            .with_for_update()
            .first()
        )
        if row is None:
            self.db.rollback()
            raise OperationInProgressError("Collection sync lease was lost.")
        row.lease_expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=self.lease_seconds
        )
        self.db.commit()

    def release(self) -> None:
        if self.slot is None:
            return
        row = (
            self.db.query(OperationLeaseSlot)
            .filter(
                OperationLeaseSlot.operation == self.operation,
                OperationLeaseSlot.slot == self.slot,
                OperationLeaseSlot.owner_user_id == self.user_id,
                OperationLeaseSlot.lease_token == self.lease_token,
            )
            .with_for_update()
            .first()
        )
        if row is not None:
            row.owner_user_id = None
            row.lease_token = None
            row.lease_expires_at = datetime.now(timezone.utc)
            self.db.commit()
        self.slot = None
        self.lease_token = None

    def _ensure_slots(self) -> None:
        limit = self.SLOT_LIMITS.get(self.operation, 1)
        added = False
        # Stage all missing fixed slots before flushing. Concurrent workers may
        # stage the same rows; the commit-time IntegrityError recovery below
        # then rolls back the loser and lets it use the winner's slots.
        with self.db.no_autoflush:
            for slot in range(1, limit + 1):
                row = self.db.get(OperationLeaseSlot, (self.operation, slot))
                if row is None:
                    self.db.add(OperationLeaseSlot(
                        operation=self.operation,
                        slot=slot,
                        owner_user_id=None,
                        lease_expires_at=datetime(1970, 1, 1, tzinfo=timezone.utc),
                        lease_token=None,
                    ))
                    added = True
        if not added:
            return
        try:
            self.db.commit()
        except IntegrityError:
            # A concurrent process may have created the same fixed slots.
            self.db.rollback()


class UserOperationGuard:
    def __init__(
        self,
        db: Session,
        user_id: int,
        operation: str,
        cooldown_seconds: int,
        lease_seconds: int,
    ):
        self.db = db
        self.user_id = user_id
        self.operation = operation
        self.cooldown_seconds = cooldown_seconds
        self.lease_seconds = lease_seconds
        self.lease_token: str | None = None

    def acquire(self) -> None:
        now = datetime.now(timezone.utc)
        row = self._locked_row()
        created = False

        if row is None:
            try:
                with self.db.begin_nested():
                    row = UserOperationLease(
                        user_id=self.user_id,
                        operation=self.operation,
                        started_at=now,
                        lease_expires_at=now + timedelta(
                            seconds=self.lease_seconds
                        ),
                        lease_token=secrets.token_urlsafe(24),
                    )
                    self.db.add(row)
                    self.db.flush()
                    created = True
            except IntegrityError:
                row = self._locked_row()

        if row is not None and not created:
            lease_expires = self._aware(row.lease_expires_at)
            started = self._aware(row.started_at)
            if lease_expires > now:
                self.db.rollback()
                raise OperationInProgressError(
                    "A collection sync is already running."
                )
            if started > now - timedelta(seconds=self.cooldown_seconds):
                self.db.rollback()
                raise OperationCooldownError(
                    "Please wait a few minutes before syncing again."
                )
            row.started_at = now
            row.lease_expires_at = now + timedelta(
                seconds=self.lease_seconds
            )
            row.lease_token = secrets.token_urlsafe(24)

        self.lease_token = row.lease_token
        self.db.commit()

    def renew(self) -> None:
        row = self._locked_owned_row()
        if row is None:
            self.db.rollback()
            raise OperationInProgressError("Collection sync lease was lost.")
        row.lease_expires_at = datetime.now(timezone.utc) + timedelta(
            seconds=self.lease_seconds
        )
        self.db.commit()

    def release(self) -> None:
        row = self._locked_owned_row()
        if row is not None:
            row.lease_expires_at = datetime.now(timezone.utc)
            self.db.commit()
        self.lease_token = None

    def _locked_owned_row(self) -> UserOperationLease | None:
        if self.lease_token is None:
            return None
        return (
            self.db.query(UserOperationLease)
            .filter(
                UserOperationLease.user_id == self.user_id,
                UserOperationLease.operation == self.operation,
                UserOperationLease.lease_token == self.lease_token,
            )
            .with_for_update()
            .first()
        )

    def _locked_row(self) -> UserOperationLease | None:
        return (
            self.db.query(UserOperationLease)
            .filter(
                UserOperationLease.user_id == self.user_id,
                UserOperationLease.operation == self.operation,
            )
            .with_for_update()
            .first()
        )

    @staticmethod
    def _aware(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
