"""clear puzzle_pool for new difficulty thresholds

Revision ID: 010
Revises: 009
Create Date: 2026-08-13

Old pooled medium/hard puzzles were accepted under the previous rater
(hardest-technique / min_steps) and older givens floors. Drop them so
refill rebuilds under path-aware grade bands and the new carve floors.

"""

from collections.abc import Sequence

from alembic import op

revision: str = "010"
down_revision: str | Sequence[str] | None = "009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DELETE FROM puzzle_pool")


def downgrade() -> None:
    # Deleted pool entries cannot be restored.
    pass
