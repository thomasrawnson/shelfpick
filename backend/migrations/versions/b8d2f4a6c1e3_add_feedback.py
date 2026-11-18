"""Add the feedback table for in-app feature ideas and problem reports.

Revision ID: b8d2f4a6c1e3
Revises: a7c1e9d3b5f2

New table only; no existing rows change. Rows belong to a user and are removed
with the account. The downgrade drops the table.
"""

from alembic import op
import sqlalchemy as sa


revision = "b8d2f4a6c1e3"
down_revision = "a7c1e9d3b5f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "feedback",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("type", sa.String(length=12), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "wants_reply",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column("app_version", sa.String(length=20), nullable=True),
        sa.Column("build", sa.String(length=20), nullable=True),
        sa.Column("os", sa.String(length=40), nullable=True),
        sa.Column("device", sa.String(length=40), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "type IN ('feature', 'problem', 'other')",
            name="ck_feedback_type",
        ),
    )
    op.create_index(
        "ix_feedback_user_created",
        "feedback",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_feedback_user_created", table_name="feedback")
    op.drop_table("feedback")
