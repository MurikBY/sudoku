"""add parties and party_members

Revision ID: 006
Revises: 005
Create Date: 2026-07-28

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006"
down_revision: str | Sequence[str] | None = "005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    party_status = postgresql.ENUM(
        "waiting",
        "started",
        "cancelled",
        name="party_status",
        create_type=True,
    )
    party_status.create(op.get_bind(), checkfirst=True)

    difficulty_enum = postgresql.ENUM(
        "easy",
        "medium",
        "hard",
        name="difficulty",
        create_type=False,
    )

    op.create_table(
        "parties",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=6), nullable=False),
        sa.Column("host_user_id", sa.BigInteger(), nullable=False),
        sa.Column("difficulty", difficulty_enum, nullable=False),
        sa.Column("assists", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(
                "waiting",
                "started",
                "cancelled",
                name="party_status",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("puzzle", sa.String(length=81), nullable=True),
        sa.Column("solution", sa.String(length=81), nullable=True),
        sa.Column("givens_count", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["host_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index("ix_parties_code", "parties", ["code"])
    op.create_index("ix_parties_host_user_id", "parties", ["host_user_id"])

    op.add_column(
        "games",
        sa.Column("party_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_games_party_id_parties",
        "games",
        "parties",
        ["party_id"],
        ["id"],
    )
    op.create_index("ix_games_party_id", "games", ["party_id"])

    op.create_table(
        "party_members",
        sa.Column("party_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("game_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"]),
        sa.ForeignKeyConstraint(["party_id"], ["parties.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("party_id", "user_id"),
    )


def downgrade() -> None:
    op.drop_table("party_members")
    op.drop_index("ix_games_party_id", table_name="games")
    op.drop_constraint("fk_games_party_id_parties", "games", type_="foreignkey")
    op.drop_column("games", "party_id")
    op.drop_index("ix_parties_host_user_id", table_name="parties")
    op.drop_index("ix_parties_code", table_name="parties")
    op.drop_table("parties")
    postgresql.ENUM(name="party_status").drop(op.get_bind(), checkfirst=True)
