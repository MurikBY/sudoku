"""add play lock columns to users

Revision ID: 007
Revises: 006
Create Date: 2026-07-28

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "007"
down_revision: str | Sequence[str] | None = "006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("play_lock_token", sa.Text(), nullable=True))
    op.add_column(
        "users",
        sa.Column("play_lock_expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "play_lock_expires_at")
    op.drop_column("users", "play_lock_token")
