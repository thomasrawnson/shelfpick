"""Add indexes for bounded retention cleanup.

Revision ID: f3a8c2d4e6b1
Revises: 8d2e4f6a7b90
"""

from typing import Sequence, Union

from alembic import op


revision: str = "f3a8c2d4e6b1"
down_revision: Union[str, Sequence[str], None] = "8d2e4f6a7b90"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_auth_tokens_expires_at",
        "auth_tokens",
        ["expires_at"],
    )
    op.create_index(
        "ix_game_night_voting_sessions_expires_at",
        "game_night_voting_sessions",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_game_night_voting_sessions_expires_at",
        table_name="game_night_voting_sessions",
    )
    op.drop_index(
        "ix_auth_tokens_expires_at",
        table_name="auth_tokens",
    )
