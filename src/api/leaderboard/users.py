import asyncio
import datetime
import uuid

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import HTTPException
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
        "type": "login",
        "role": role,
    }
    return jwt.encode(payload, PRIVKEY, algorithm="HS256")


def create_invite_token(admin_id: uuid.UUID, duration_hours: int = 24):
    payload = {
        "sub": str(admin_id),
        "type": "invite",
        "exp": datetime.datetime.now(datetime.timezone.utc)
        + datetime.timedelta(hours=int(duration_hours)),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, PRIVKEY, algorithm="HS256")


def decode_jwt(token):
    payload = jwt.decode(token, PRIVKEY, algorithms=["HS256"])
    if payload.get("type") != "login":
        raise HTTPException(status_code=403, detail="Invalid return type")
    return payload


def verify_invite_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            PRIVKEY,
            algorithms=["HS256"],
            options={"require": ["exp", "sub"]},
        )

        if payload.get("type") != "invite":
            raise HTTPException(status_code=403, detail="Invalid token type")
        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Invite link has expired")
    except jwt.InvalidSignatureError:
        raise HTTPException(status_code=403, detail="Invalid token signature")
    except jwt.PyJWTError:
        raise HTTPException(status_code=400, detail="Malformed or invalid token")
