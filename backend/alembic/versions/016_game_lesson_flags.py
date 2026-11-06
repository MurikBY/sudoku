"""add game lesson flags

Revision ID: 016
Revises: 015
Create Date: 2026-08-30

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "016"
down_revision: str | Sequence[str] | None = "015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "games",
        sa.Column(
            "is_lesson",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "games",
        sa.Column("lesson_technique", sa.String(), nullable=True),
    )
    op.add_column(
        "games",
        sa.Column("lesson_position_id", sa.String(), nullable=True),
    )
    op.create_index("ix_games_is_lesson", "games", ["is_lesson"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_games_is_lesson", table_name="games")
    op.drop_column("games", "lesson_position_id")
    op.drop_column("games", "lesson_technique")
    op.drop_column("games", "is_lesson")
