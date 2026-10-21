"""add password column to users

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-21
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing rows get "!" - not a valid Argon2 hash, so it can never match
    # any password (account is effectively locked until a password is set).
    op.add_column(
        "users",
        sa.Column("password", sa.Text(), nullable=False, server_default="!"),
    )
    # New rows must always supply a real hash.
    op.alter_column("users", "password", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "password")
