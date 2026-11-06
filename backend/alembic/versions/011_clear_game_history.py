"""clear game history for path-aware difficulty

Revision ID: 011
Revises: 010
Create Date: 2026-08-13

Games and party results were rated under the old difficulty rules.
Wipe play history and counters so leaderboards/stats match the new
path-aware grade bands. Preferences and puzzle_pool are kept.

"""

from collections.abc import Sequence

from alembic import op

revision: str = "011"
down_revision: str | Sequence[str] | None = "010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("DELETE FROM party_members")
    op.execute("DELETE FROM games")
    op.execute("DELETE FROM parties")
    op.execute(
        """
        UPDATE users SET
            games_started = 0,
            games_completed = 0,
            total_play_seconds = 0,
            best_time_easy = NULL,
            best_time_medium = NULL,
            best_time_hard = NULL,
            play_lock_token = NULL,
            play_lock_expires_at = NULL
        """
    )


def downgrade() -> None:
    # Deleted play history cannot be restored from this migration.
    pass
