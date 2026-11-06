"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-07-15

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

difficulty_enum = sa.Enum("easy", "medium", "hard", name="difficulty")
game_status_enum = sa.Enum("in_progress", "completed", "abandoned", name="game_status")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("username", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("games_started", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("games_completed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_play_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("best_time_easy", sa.Integer(), nullable=True),
        sa.Column("best_time_medium", sa.Integer(), nullable=True),
        sa.Column("best_time_hard", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "games",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("difficulty", difficulty_enum, nullable=False),
        sa.Column("status", game_status_enum, nullable=False),
        sa.Column("puzzle", sa.String(length=81), nullable=False),
        sa.Column("solution", sa.String(length=81), nullable=False),
        sa.Column("current_grid", sa.String(length=81), nullable=False),
        sa.Column("mistakes_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("elapsed_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_games_user_id", "games", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_games_user_id", table_name="games")
    op.drop_table("games")
    op.drop_table("users")
    game_status_enum.drop(op.get_bind(), checkfirst=True)
    difficulty_enum.drop(op.get_bind(), checkfirst=True)
