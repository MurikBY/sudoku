"""add game share_code, events, assists, analysis flags

Revision ID: 013
Revises: 012
Create Date: 2026-08-14

"""

from __future__ import annotations

import secrets
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "013"
down_revision: str | Sequence[str] | None = "012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_CODE_LENGTH = 8


def _unique_share_codes(count: int) -> list[str]:
    codes: set[str] = set()
    while len(codes) < count:
        codes.add("".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH)))
    return list(codes)


def upgrade() -> None:
    op.add_column(
        "games",
        sa.Column("share_code", sa.String(length=8), nullable=True),
    )
    op.add_column(
        "games",
        sa.Column(
            "events",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column(
        "games",
        sa.Column("assists", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "games",
        sa.Column(
            "is_analysis",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "games",
        sa.Column("analysis_source_game_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_games_analysis_source_game_id",
        "games",
        "games",
        ["analysis_source_game_id"],
        ["id"],
    )

    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id FROM games WHERE share_code IS NULL")).fetchall()
    if rows:
        codes = _unique_share_codes(len(rows))
        for row, code in zip(rows, codes, strict=True):
            connection.execute(
                sa.text("UPDATE games SET share_code = :code WHERE id = :id"),
                {"code": code, "id": row[0]},
            )

    op.alter_column("games", "share_code", nullable=False)
    op.create_index("ix_games_share_code", "games", ["share_code"], unique=True)
    op.create_index("ix_games_is_analysis", "games", ["is_analysis"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_games_is_analysis", table_name="games")
    op.drop_index("ix_games_share_code", table_name="games")
    op.drop_constraint("fk_games_analysis_source_game_id", "games", type_="foreignkey")
    op.drop_column("games", "analysis_source_game_id")
    op.drop_column("games", "is_analysis")
    op.drop_column("games", "assists")
    op.drop_column("games", "events")
    op.drop_column("games", "share_code")
