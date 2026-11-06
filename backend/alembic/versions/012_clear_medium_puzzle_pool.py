"""clear medium puzzle_pool for higher medium grade

Revision ID: 012
Revises: 011
Create Date: 2026-08-13

Medium accept now requires path volume (GRADE_MEDIUM_MIN ≈ 2.15).
Drop pooled medium entries so refill rebuilds under the new band.
Easy/hard pool stock is kept.

"""

from collections.abc import Sequence

from alembic import op

revision: str = "012"
down_revision: str | Sequence[str] | None = "011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DELETE FROM puzzle_pool WHERE difficulty = 'medium'")


def downgrade() -> None:
    # Deleted pool entries cannot be restored.
    pass
