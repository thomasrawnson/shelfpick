"""Add saved Picker play-style preference.

Revision ID: 9d4e7a2b1c6f
Revises: 6ac2f16e3a91
"""

from alembic import op
import sqlalchemy as sa


revision = "9d4e7a2b1c6f"
down_revision = "6ac2f16e3a91"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("preferred_play_style", sa.String(length=16), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "preferred_play_style")
