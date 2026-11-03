"""Add public-launch security state.

Revision ID: 8d2e4f6a7b90
Revises: c15f4b6d8e20
"""

from typing import Sequence, Union
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


revision: str = "8d2e4f6a7b90"
down_revision: Union[str, Sequence[str], None] = "c15f4b6d8e20"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "token_version",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    op.create_table(
        "auth_rate_limits",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("scope", sa.String(length=32), nullable=False),
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "scope", "key_hash", name="uq_auth_rate_limits_scope_key",
        ),
    )
    op.create_index(
        "ix_auth_rate_limits_updated_at",
        "auth_rate_limits",
        ["updated_at"],
    )

    op.create_table(
        "user_operation_leases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("operation", sa.String(length=32), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lease_token", sa.String(length=64), nullable=False),
        sa.UniqueConstraint(
            "user_id", "operation", name="uq_user_operation_leases_user_operation",
        ),
    )
    op.create_index(
        "ix_user_operation_leases_user_id",
        "user_operation_leases",
        ["user_id"],
    )

    operation_slots = op.create_table(
        "operation_lease_slots",
        sa.Column("operation", sa.String(length=32), primary_key=True),
        sa.Column("slot", sa.Integer(), primary_key=True),
        sa.Column(
            "owner_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("lease_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("lease_token", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_operation_lease_slots_owner_user_id",
        "operation_lease_slots",
        ["owner_user_id"],
    )
    op.bulk_insert(
        operation_slots,
        [
            {
                "operation": "collection-sync",
                "slot": slot,
                "owner_user_id": None,
                "lease_expires_at": datetime(1970, 1, 1, tzinfo=timezone.utc),
                "lease_token": None,
            }
            for slot in (1, 2)
        ],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_operation_lease_slots_owner_user_id",
        table_name="operation_lease_slots",
    )
    op.drop_table("operation_lease_slots")
    op.drop_index(
        "ix_user_operation_leases_user_id",
        table_name="user_operation_leases",
    )
    op.drop_table("user_operation_leases")
    op.drop_index(
        "ix_auth_rate_limits_updated_at",
        table_name="auth_rate_limits",
    )
    op.drop_table("auth_rate_limits")
    op.drop_column("users", "token_version")
