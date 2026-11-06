"""drop write-only users counters

Revision ID: 019
Revises: 018
Create Date: 2026-10-23

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "019"
down_revision: str | Sequence[str] | None = "018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_USER_COUNTERS = (
    "games_started",
    "games_completed",
    "total_play_seconds",
    "best_time_easy",
    "best_time_medium",
    "best_time_hard",
)


def upgrade() -> None:
    for column in _USER_COUNTERS:
        op.drop_column("users", column)


def downgrade() -> None:
    # Dropped counter values are not recoverable.
    for column in _USER_COUNTERS:
        op.add_column("users", sa.Column(column, sa.Integer(), nullable=True))
