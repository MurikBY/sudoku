"""rating counters keep play after a personal stats reset

Revision ID: 018
Revises: 017
Create Date: 2026-09-29

Seed matches ARCHIVED_RATING_BEFORE_DIFFICULTY_RESET. Later resets add to these
rows; they do not change that constant.

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "018"
down_revision: str | Sequence[str] | None = "017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    difficulty_enum = postgresql.ENUM(
        "easy",
        "medium",
        "hard",
        name="difficulty",
        create_type=False,
    )
    op.create_table(
        "rating_counter_archive",
        sa.Column("difficulty", difficulty_enum, nullable=False),
        sa.Column("games_started", sa.Integer(), nullable=False),
        sa.Column("games_completed", sa.Integer(), nullable=False),
        sa.Column("clean_wins", sa.Integer(), nullable=False),
        sa.Column("clean_elapsed_sum", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("difficulty"),
    )
    archive = sa.table(
        "rating_counter_archive",
        sa.column("difficulty", postgresql.ENUM(name="difficulty", create_type=False)),
        sa.column("games_started", sa.Integer),
        sa.column("games_completed", sa.Integer),
        sa.column("clean_wins", sa.Integer),
        sa.column("clean_elapsed_sum", sa.Integer),
    )
    op.bulk_insert(
        archive,
        [
            {
                "difficulty": "easy",
                "games_started": 220,
                "games_completed": 91,
                "clean_wins": 68,
                "clean_elapsed_sum": 29212,
            },
            {
                "difficulty": "medium",
                "games_started": 107,
                "games_completed": 36,
                "clean_wins": 18,
                "clean_elapsed_sum": 29349,
            },
            {
                "difficulty": "hard",
                "games_started": 51,
                "games_completed": 22,
                "clean_wins": 13,
                "clean_elapsed_sum": 16472,
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("rating_counter_archive")
