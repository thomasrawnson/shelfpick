"""Add scoresheets, their versions, and scoresheet breakdowns on plays.

Revision ID: d2b6f0a9c4e8
Revises: a7c1e9d3b5f2

Additive only. Existing plays keep ``scoresheet_id``, ``scoresheet_version``
and every ``score_breakdown`` NULL, and ``result_overridden`` false through
its server default, so their scores and outcomes are unchanged. Built-in
sheets are not seeded here; ``python -m scripts.seed_scoresheets`` loads them
from ``scoresheets/templates`` after the upgrade. The downgrade drops the new
columns and tables, and with them every breakdown and custom sheet.
"""

from alembic import op
import sqlalchemy as sa


revision = "d2b6f0a9c4e8"
down_revision = "a7c1e9d3b5f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scoresheets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("bgg_game_id", sa.Integer(), nullable=True),
        sa.Column(
            "owner_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("schema", sa.JSON(), nullable=False),
        sa.Column("format_version", sa.Integer(), nullable=False),
        sa.Column(
            "version", sa.Integer(), nullable=False, server_default="1",
        ),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
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
    )
    op.create_index(
        "ix_scoresheets_bgg_game_id", "scoresheets", ["bgg_game_id"],
    )
    op.create_index(
        "ix_scoresheets_owner_user_id", "scoresheets", ["owner_user_id"],
    )
    op.create_index(
        "uq_scoresheets_builtin_bgg_game_id",
        "scoresheets",
        ["bgg_game_id"],
        unique=True,
        postgresql_where=sa.text("owner_user_id IS NULL"),
        sqlite_where=sa.text("owner_user_id IS NULL"),
    )

    op.create_table(
        "scoresheet_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "scoresheet_id",
            sa.Integer(),
            sa.ForeignKey("scoresheets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("schema", sa.JSON(), nullable=False),
        sa.Column("format_version", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "scoresheet_id",
            "version",
            name="uq_scoresheet_versions_sheet_version",
        ),
    )
    op.create_index(
        "ix_scoresheet_versions_scoresheet_id",
        "scoresheet_versions",
        ["scoresheet_id"],
    )

    op.add_column(
        "plays",
        sa.Column(
            "scoresheet_id",
            sa.Integer(),
            sa.ForeignKey(
                "scoresheets.id",
                name="fk_plays_scoresheet_id_scoresheets",
                ondelete="SET NULL",
            ),
            nullable=True,
        ),
    )
    op.create_index("ix_plays_scoresheet_id", "plays", ["scoresheet_id"])
    op.add_column(
        "plays",
        sa.Column("scoresheet_version", sa.Integer(), nullable=True),
    )
    op.add_column(
        "plays",
        sa.Column(
            "result_overridden",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "play_participants",
        sa.Column("score_breakdown", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("play_participants", "score_breakdown")
    op.drop_column("plays", "result_overridden")
    op.drop_column("plays", "scoresheet_version")
    op.drop_index("ix_plays_scoresheet_id", table_name="plays")
    op.drop_constraint(
        "fk_plays_scoresheet_id_scoresheets", "plays", type_="foreignkey",
    )
    op.drop_column("plays", "scoresheet_id")
    op.drop_index(
        "ix_scoresheet_versions_scoresheet_id",
        table_name="scoresheet_versions",
    )
    op.drop_table("scoresheet_versions")
    op.drop_index("uq_scoresheets_builtin_bgg_game_id", table_name="scoresheets")
    op.drop_index("ix_scoresheets_owner_user_id", table_name="scoresheets")
    op.drop_index("ix_scoresheets_bgg_game_id", table_name="scoresheets")
    op.drop_table("scoresheets")
