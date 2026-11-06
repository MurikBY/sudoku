"""set analysis source foreign key to on delete set null

Revision ID: 022
Revises: 021
Create Date: 2026-11-04

"""

from collections.abc import Sequence

from alembic import op

revision: str = "022"
down_revision: str | Sequence[str] | None = "021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("fk_games_analysis_source_game_id", "games", type_="foreignkey")
    op.create_foreign_key(
        "fk_games_analysis_source_game_id",
        "games",
        "games",
        ["analysis_source_game_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_games_analysis_source_game_id", "games", type_="foreignkey")
    op.create_foreign_key(
        "fk_games_analysis_source_game_id",
        "games",
        "games",
        ["analysis_source_game_id"],
        ["id"],
    )
