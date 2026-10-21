import asyncio
import datetime

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from sqlalchemy import select

from api.leaderboard.config import PRIVKEY
from api.leaderboard.db import Session
from api.leaderboard.schema import User

ph = PasswordHasher()

# Verified against when the username doesn't exist, so response time doesn't
# reveal which usernames are registered.
DUMMY_HASH = ph.hash("not-a-real-password")


async def hash_user_password(password):
    return await asyncio.to_thread(ph.hash, password)


async def check_user_password(password, dbHash):
    try:
        return await asyncio.to_thread(ph.verify, dbHash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


async def get_user_by_username(username):
    async with Session() as session:
        return await session.scalar(select(User).where(User.username == username))


def create_jwt_token(user_id, role="user"):
    payload = {
        "sub": str(user_id),
        "exp": datetime.datetime.now(datetime.timezone.utc)
        + datetime.timedelta(hours=1),
        "role": role,
    }
    return jwt.encode(payload, PRIVKEY, algorithm="HS256")


def decode_jwt(token):
    payload = jwt.decode(token, PRIVKEY, algorithms=["HS256"])
    return payload
