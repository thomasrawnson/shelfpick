"""Add play outcome type, co-op result and per-participant team, rank, role.

Revision ID: a7c1e9d3b5f2
Revises: f3a8c2d4e6b1

Backfill: every existing play becomes ``competitive`` through the column's
server default, and the new participant columns stay NULL. ``is_winner`` is
not touched, so win, loss, draw and unknown counts are identical before and
after the upgrade. The downgrade drops only the new columns.
"""

from alembic import op
import sqlalchemy as sa


revision = "a7c1e9d3b5f2"
down_revision = "f3a8c2d4e6b1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "plays",
        sa.Column(
            "outcome_type",
            sa.String(length=12),
            nullable=False,
            server_default="competitive",
        ),
    )
    op.add_column(
        "plays",
        sa.Column("coop_result", sa.String(length=4), nullable=True),
    )
    op.add_column(
        "play_participants",
        sa.Column("team", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "play_participants",
        sa.Column("rank", sa.Integer(), nullable=True),
    )
    op.add_column(
        "play_participants",
        sa.Column("role", sa.String(length=50), nullable=True),
    )
    op.create_check_constraint(
        "ck_plays_outcome_type",
        "plays",
        "outcome_type IN ('competitive', 'cooperative', 'team', 'solo')",
    )
    op.create_check_constraint(
        "ck_plays_coop_result",
        "plays",
        "coop_result IN ('won', 'lost')",
    )
    op.create_check_constraint(
        "ck_play_participants_rank_positive",
        "play_participants",
        "rank IS NULL OR rank > 0",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_play_participants_rank_positive",
        "play_participants",
        type_="check",
    )
    op.drop_constraint("ck_plays_coop_result", "plays", type_="check")
    op.drop_constraint("ck_plays_outcome_type", "plays", type_="check")
    op.drop_column("play_participants", "role")
    op.drop_column("play_participants", "rank")
    op.drop_column("play_participants", "team")
    op.drop_column("plays", "coop_result")
    op.drop_column("plays", "outcome_type")
