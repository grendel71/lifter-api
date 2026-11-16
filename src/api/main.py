import uuid
from contextlib import asynccontextmanager

import jwt
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

import api.leaderboard.config  # noqa: F401  (validates env vars and builds PG_DSN)
from api.leaderboard.config import MAX_INVITE_HOURS
from api.leaderboard.db import Session, init_db
from api.leaderboard.requestclass import (
    CreateUser,
    LifterResponse,
    Login,
    UpdateUser,
    UserPublic,
    UserResponse,
)
from api.leaderboard.schema import Lifter, User
from api.leaderboard.users import (
    DUMMY_HASH,
    check_user_password,
    create_invite_token,
    create_jwt_token,
    decode_jwt,
    get_user_by_username,
    hash_user_password,
    verify_invite_token,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield


app = FastAPI(lifespan=lifespan)

bearer = HTTPBearer()


def current_user_id(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> uuid.UUID:
    try:
        return uuid.UUID(decode_jwt(creds.credentials)["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(
            401, "Invalid or expired token", headers={"WWW-Authenticate": "Bearer"}
        )


def current_user_role(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> uuid.UUID:
    try:
        return decode_jwt(creds.credentials)["role"]
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(
            401, "Invalid or expired token", headers={"WWW-Authenticate": "Bearer"}
        )


@app.get("/api/health")
def health_check():
    return {"status": "Ok"}


@app.get("/api/v1/users/{user_id}", response_model=UserPublic)
async def read_item(user_id: uuid.UUID):
    async with Session() as session:
        user = await session.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        return user


@app.get("/api/v1/users", response_model=list[UserPublic])
async def list_users():
    async with Session() as session:
        result = await session.execute(select(User))
        return result.scalars().all()


@app.post("/api/v1/users", status_code=201)
async def create_user(
    payload: CreateUser,
):
    invite_data = verify_invite_token(payload.invite_token)
    hashed = await hash_user_password(payload.password)
    try:
        async with Session() as session:
            user = User(
                name=payload.name,
                username=payload.username,
                password=hashed,
                role="User",
            )
            session.add(user)
            await session.flush()

            lifter = Lifter(
                lifter_id=user.id,
                squat=0,
                bench=0,
                deadlift=0,
            )
            session.add(lifter)
            await session.commit()

            return UserResponse(user_id=user.id)
    except IntegrityError:
        raise HTTPException(status_code=409, detail="Username already taken")


@app.get("/api/v1/users/{user_id}/performance")
async def read_performance(user_id: uuid.UUID):
    async with Session() as session:
        lifter = await session.get(Lifter, user_id)
        if lifter is None:
            raise HTTPException(status_code=404, detail="Lifter not found")
        response = LifterResponse(
            lifter_id=lifter.lifter_id,
            squat=lifter.squat,
            bench=lifter.bench,
            deadlift=lifter.deadlift,
        )
        return response


@app.put("/api/v1/users/{user_id}/updatePerformance")
async def update_user(
    user_id: uuid.UUID,
    payload: UpdateUser,
    caller: uuid.UUID = Depends(current_user_id),
    callerRole: str = Depends(current_user_role),
):
    async with Session() as session:
        if (caller != user_id) and (callerRole != "Admin"):
            raise HTTPException(403, "You can only modify your own account")
        user = await session.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        lifter = await session.get(Lifter, user_id)
        if lifter is None:
            raise HTTPException(status_code=404, detail="Lifter not found")
        changes = payload.model_dump(exclude_unset=True, exclude_none=True)
        if not changes:
            raise HTTPException(status_code=404, detail="No fields to update")
        if "name" in changes:
            user.name = changes["name"]
        for lift in ("squat", "bench", "deadlift"):
            if lift in changes:
                setattr(lifter, lift, changes[lift])
        await session.commit()
        return {"status": "ok"}


@app.delete("/api/v1/users/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    caller: uuid.UUID = Depends(current_user_id),
    callerRole: str = Depends(current_user_role),
):
    async with Session() as session:
        if (caller != user_id) and (callerRole != "Admin"):
            raise HTTPException(403, "You can only modify your own account")
        user = await session.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        await session.delete(user)
        await session.commit()

        return {"status": "ok"}


@app.post("/api/v1/login")
async def login_user(payload: Login):
    user = await get_user_by_username(payload.username)

    db_hash = user.password if user else DUMMY_HASH
    password_ok = await check_user_password(payload.password, db_hash)

    if user is None or not password_ok:
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    if (user.role) == "Admin":
        userJWT = create_jwt_token(user.id, "Admin")
    else:
        userJWT = create_jwt_token(user.id)

    return {"access_token": userJWT, "token_type": "bearer"}


@app.post("/api/v1/createInviteToken")
async def create_invite_token_endpoint(
    duration: int = Query(24, ge=1, le=MAX_INVITE_HOURS),
    caller: uuid.UUID = Depends(current_user_id),
    callerRole: str = Depends(current_user_role),
):
    if callerRole != "Admin":
        raise HTTPException(403, "Unauthorized")
    inviteToken = create_invite_token(caller, duration)

    return {"invite_token": inviteToken}
