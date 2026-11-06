"""clear hard puzzle_pool after XYZ-Wing peer fix

Revision ID: 014
Revises: 013
Create Date: 2026-08-14

XYZ-Wing eliminations now require the victim to see the pivot as well as
both wings. Hard pool entries rated under the looser rule may need chains
beyond supported Hard techniques – drop them so refill rebuilds correctly.
Easy/medium pool stock is kept.

"""

from collections.abc import Sequence

from alembic import op

revision: str = "014"
down_revision: str | Sequence[str] | None = "013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DELETE FROM puzzle_pool WHERE difficulty = 'hard'")


def downgrade() -> None:
    # Deleted pool entries cannot be restored.
    pass
