"""create users and lifters tables

Revision ID: 0001
Revises:
Create Date: 2026-10-20
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "lifters",
        sa.Column("lifter_id", sa.Uuid(), nullable=False),
        sa.Column("squat", sa.Integer(), nullable=False),
        sa.Column("bench", sa.Integer(), nullable=False),
        sa.Column("deadlift", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["lifter_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("lifter_id"),
    )


def downgrade() -> None:
    op.drop_table("lifters")
    op.drop_table("users")
