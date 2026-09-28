"""Add play locations and account-scoped live timers.

Revision ID: b04c8f13a2d7
Revises: 9d4e7a2b1c6f
"""

from alembic import op
import sqlalchemy as sa

revision = "b04c8f13a2d7"
down_revision = "9d4e7a2b1c6f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("plays", sa.Column("location", sa.String(length=200), nullable=True))
    op.add_column("plays", sa.Column("timer_session_id", sa.String(length=36), nullable=True))
    op.create_unique_constraint("uq_plays_timer_session_id", "plays", ["timer_session_id"])
    op.create_table(
        "live_play_timers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("public_id", sa.String(length=36), nullable=False, unique=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("game_id", sa.Integer(), sa.ForeignKey("games.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=12), nullable=False),
        sa.Column("accumulated_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("running_since", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("draft_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_live_play_timers_user_id", "live_play_timers", ["user_id"], unique=True)
    op.create_index("ix_live_play_timers_game_id", "live_play_timers", ["game_id"])


def downgrade() -> None:
    op.drop_index("ix_live_play_timers_game_id", table_name="live_play_timers")
    op.drop_index("ix_live_play_timers_user_id", table_name="live_play_timers")
    op.drop_table("live_play_timers")
    op.drop_constraint("uq_plays_timer_session_id", "plays", type_="unique")
    op.drop_column("plays", "timer_session_id")
    op.drop_column("plays", "location")
