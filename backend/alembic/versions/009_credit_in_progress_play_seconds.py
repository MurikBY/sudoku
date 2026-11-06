"""recompute users.total_play_seconds from games

Revision ID: 009
Revises: 008
Create Date: 2026-08-02

"""

from collections.abc import Sequence

from alembic import op

revision: str = "009"
down_revision: str | Sequence[str] | None = "008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Source of truth is SUM(games.elapsed_seconds) across all statuses.
    # Idempotent if new code already credited in-progress deltas before migrate.
    op.execute(
        """
        UPDATE users AS u
        SET total_play_seconds = COALESCE(
            (
                SELECT SUM(g.elapsed_seconds)
                FROM games AS g
                WHERE g.user_id = u.id
            ),
            0
        )
        """,
    )


def downgrade() -> None:
    # Cannot restore prior denormalized values; leave totals as recomputed.
    pass
