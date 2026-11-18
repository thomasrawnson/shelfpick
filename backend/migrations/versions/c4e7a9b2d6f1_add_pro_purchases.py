"""Add account public IDs and verified Pro purchase entitlements.

Revision ID: c4e7a9b2d6f1
Revises: b8d2f4a6c1e3

``users.public_id`` is added, backfilled with a random UUID for every existing
account, then made required and unique. It identifies the account to the
purchase provider, so no email address or numeric ID leaves the server.
``purchase_entitlements`` is a new table holding at most one row per user; its
rows are removed with the account. Existing tiers and manual Pro grants on
``users.tier`` are not changed. The downgrade drops both additions.
"""

from alembic import op
import sqlalchemy as sa


revision = "c4e7a9b2d6f1"
down_revision = "b8d2f4a6c1e3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("public_id", sa.String(length=36), nullable=True),
    )
    op.execute("UPDATE users SET public_id = gen_random_uuid()::text")
    op.alter_column("users", "public_id", nullable=False)
    op.create_unique_constraint("uq_users_public_id", "users", ["public_id"])

    op.create_table(
        "purchase_entitlements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("plan", sa.String(length=10), nullable=False),
        sa.Column("product_id", sa.String(length=120), nullable=False),
        sa.Column("store", sa.String(length=24), nullable=True),
        sa.Column("environment", sa.String(length=12), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "last_synced_at", sa.DateTime(timezone=True), nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "status IN ('ACTIVE', 'EXPIRED', 'REVOKED')",
            name="ck_purchase_entitlements_status",
        ),
        sa.CheckConstraint(
            "plan IN ('LIFETIME', 'YEARLY')",
            name="ck_purchase_entitlements_plan",
        ),
    )


def downgrade() -> None:
    op.drop_table("purchase_entitlements")
    op.drop_constraint("uq_users_public_id", "users", type_="unique")
    op.drop_column("users", "public_id")
