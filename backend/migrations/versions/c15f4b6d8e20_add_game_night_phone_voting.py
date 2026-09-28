"""Add Game Night phone voting sessions and ballots.

Revision ID: c15f4b6d8e20
Revises: b04c8f13a2d7
"""

from alembic import op
import sqlalchemy as sa


revision = "c15f4b6d8e20"
down_revision = "b04c8f13a2d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "game_night_voting_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("public_id", sa.String(length=36), nullable=False),
        sa.Column("join_token_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "host_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=12), nullable=False, server_default="open"),
        sa.Column("candidates", sa.JSON(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_game_night_voting_sessions_public_id",
        "game_night_voting_sessions", ["public_id"], unique=True,
    )
    op.create_index(
        "ix_game_night_voting_sessions_join_token_hash",
        "game_night_voting_sessions", ["join_token_hash"], unique=True,
    )
    op.create_index(
        "ix_game_night_voting_sessions_host_user_id",
        "game_night_voting_sessions", ["host_user_id"],
    )

    op.create_table(
        "game_night_guests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("public_id", sa.String(length=36), nullable=False),
        sa.Column(
            "session_id", sa.Integer(),
            sa.ForeignKey("game_night_voting_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("credential_hash", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=40), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "session_id", "credential_hash",
            name="uq_game_night_guest_session_credential",
        ),
    )
    op.create_index(
        "ix_game_night_guests_public_id",
        "game_night_guests", ["public_id"], unique=True,
    )
    op.create_index(
        "ix_game_night_guests_session_id",
        "game_night_guests", ["session_id"],
    )

    op.create_table(
        "game_night_ballots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "session_id", sa.Integer(),
            sa.ForeignKey("game_night_voting_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "guest_id", sa.Integer(),
            sa.ForeignKey("game_night_guests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("candidate_bgg_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            nullable=False, server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "session_id", "guest_id",
            name="uq_game_night_ballot_session_guest",
        ),
    )
    op.create_index(
        "ix_game_night_ballots_session_id",
        "game_night_ballots", ["session_id"],
    )
    op.create_index(
        "ix_game_night_ballots_guest_id",
        "game_night_ballots", ["guest_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_game_night_ballots_guest_id", table_name="game_night_ballots")
    op.drop_index("ix_game_night_ballots_session_id", table_name="game_night_ballots")
    op.drop_table("game_night_ballots")
    op.drop_index("ix_game_night_guests_session_id", table_name="game_night_guests")
    op.drop_index("ix_game_night_guests_public_id", table_name="game_night_guests")
    op.drop_table("game_night_guests")
    op.drop_index(
        "ix_game_night_voting_sessions_host_user_id",
        table_name="game_night_voting_sessions",
    )
    op.drop_index(
        "ix_game_night_voting_sessions_join_token_hash",
        table_name="game_night_voting_sessions",
    )
    op.drop_index(
        "ix_game_night_voting_sessions_public_id",
        table_name="game_night_voting_sessions",
    )
    op.drop_table("game_night_voting_sessions")
