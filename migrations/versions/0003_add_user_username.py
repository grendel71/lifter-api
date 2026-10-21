"""add unique username column to users

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-21
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add as nullable, backfill existing rows with their (unique) id, then lock down.
    op.add_column("users", sa.Column("username", sa.Text(), nullable=True))
    op.execute("UPDATE users SET username = id::text WHERE username IS NULL")
    op.alter_column("users", "username", nullable=False)
    op.create_unique_constraint("users_username_key", "users", ["username"])


def downgrade() -> None:
    op.drop_constraint("users_username_key", "users", type_="unique")
    op.drop_column("users", "username")
