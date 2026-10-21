"""add role column to users

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-21
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing rows get "User" as a safe default. New rows must always
    # supply a role explicitly (the app always sets one on create).
    op.add_column(
        "users",
        sa.Column("role", sa.Text(), nullable=False, server_default="User"),
    )
    op.alter_column("users", "role", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "role")
