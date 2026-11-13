"""index member and analysis-source lookups, drop duplicate indexes

Revision ID: 024
Revises: 023
Create Date: 2026-11-13

"""

from collections.abc import Sequence

from alembic import op

revision: str = "024"
down_revision: str | Sequence[str] | None = "023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The lobby poll and every party write find a player's memberships by user_id.
    op.create_index("ix_party_members_user_id", "party_members", ["user_id"])
    # Deleting a game checks these foreign keys; without an index each check scans the table.
    op.create_index("ix_party_members_game_id", "party_members", ["game_id"])
    op.create_index("ix_games_analysis_source_game_id", "games", ["analysis_source_game_id"])

    # parties.code had a unique constraint and a second, plain index. One unique index stays.
    op.drop_index("ix_parties_code", table_name="parties")
    op.create_index("ix_parties_code", "parties", ["code"], unique=True)
    op.drop_constraint("parties_code_key", "parties", type_="unique")

    # (difficulty, created_at) already serves every lookup by difficulty.
    op.drop_index("ix_puzzle_pool_difficulty", table_name="puzzle_pool")


def downgrade() -> None:
    op.create_index("ix_puzzle_pool_difficulty", "puzzle_pool", ["difficulty"])

    op.create_unique_constraint("parties_code_key", "parties", ["code"])
    op.drop_index("ix_parties_code", table_name="parties")
    op.create_index("ix_parties_code", "parties", ["code"])

    op.drop_index("ix_games_analysis_source_game_id", table_name="games")
    op.drop_index("ix_party_members_game_id", table_name="party_members")
    op.drop_index("ix_party_members_user_id", table_name="party_members")
