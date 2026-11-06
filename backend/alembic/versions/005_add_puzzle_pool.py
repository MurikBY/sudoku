"""add puzzle_pool table

Revision ID: 005
Revises: 004
Create Date: 2026-07-28

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005"
down_revision: str | Sequence[str] | None = "004"
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
        "puzzle_pool",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("difficulty", difficulty_enum, nullable=False),
        sa.Column("puzzle", sa.String(length=81), nullable=False),
        sa.Column("solution", sa.String(length=81), nullable=False),
        sa.Column("givens_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_puzzle_pool_difficulty", "puzzle_pool", ["difficulty"])
    op.create_index(
        "ix_puzzle_pool_difficulty_created_at",
        "puzzle_pool",
        ["difficulty", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_puzzle_pool_difficulty_created_at", table_name="puzzle_pool")
    op.drop_index("ix_puzzle_pool_difficulty", table_name="puzzle_pool")
    op.drop_table("puzzle_pool")
