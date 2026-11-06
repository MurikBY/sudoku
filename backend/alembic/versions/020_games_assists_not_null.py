"""store default assists on legacy games

Revision ID: 020
Revises: 019
Create Date: 2026-10-24

"""

from collections.abc import Sequence

from alembic import op

revision: str = "020"
down_revision: str | Sequence[str] | None = "019"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Frozen DEFAULT_ASSISTS.model_dump(mode="json") from preferences_service.
_DEFAULT_ASSISTS_JSON = (
    '{"pencil": true, "highlight_peers": true, "highlight_same_digit": true, '
    '"mistake_feedback": true, "dim_completed_digits": true, '
    '"unit_complete_animation": true, "auto_clear_notes": true, "sticky_digit": false}'
)


def upgrade() -> None:
    op.execute(
        "UPDATE games SET assists = '" + _DEFAULT_ASSISTS_JSON + "'::jsonb WHERE assists IS NULL",
    )
    op.alter_column("games", "assists", nullable=False)


def downgrade() -> None:
    op.alter_column("games", "assists", nullable=True)
