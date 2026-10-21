import uuid
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, computed_field

Lift = Annotated[int, Field(ge=0, lt=10000)]


class CreateUser(BaseModel):
    name: str
    username: str
    password: str


class UserResponse(BaseModel):
    user_id: uuid.UUID


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str


class Login(BaseModel):
    username: str
    password: str


class LifterResponse(BaseModel):
    lifter_id: uuid.UUID
    squat: int
    bench: int
    deadlift: int

    @computed_field
    @property
    def total(self) -> int:
        try:
            return self.squat + self.bench + self.deadlift
        except:
            return 0


class UpdateUser(BaseModel):
    name: str | None = None
    squat: Lift | None = None
    bench: Lift | None = None
    deadlift: Lift | None = None
