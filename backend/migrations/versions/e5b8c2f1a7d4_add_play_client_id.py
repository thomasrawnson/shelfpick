"""Add plays.client_id so a retried play is created once.

Revision ID: e5b8c2f1a7d4
Revises: c4e7a9b2d6f1

``plays.client_id`` is a nullable UUID string the app generates for each new
play. ``(user_id, client_id)`` is unique, so a play the device sends twice
(a retry after a lost response, or a play queued offline and synced later)
is created once. Every existing play keeps a null ``client_id``; nulls do not
collide, so imports (``source`` and ``source_play_id``) and plays from an
older app build are unaffected. The downgrade drops the constraint and the
column and loses only these ids.
"""

from alembic import op
import sqlalchemy as sa


revision = "e5b8c2f1a7d4"
down_revision = "c4e7a9b2d6f1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("plays", sa.Column("client_id", sa.String(length=36), nullable=True))
    op.create_unique_constraint("uq_plays_user_client_id", "plays", ["user_id", "client_id"])


def downgrade() -> None:
    op.drop_constraint("uq_plays_user_client_id", "plays", type_="unique")
    op.drop_column("plays", "client_id")
