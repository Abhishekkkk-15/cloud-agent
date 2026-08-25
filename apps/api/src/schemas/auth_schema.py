from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class GoogleAuthRequest(BaseModel):
    credential: str = Field(min_length=20)


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=20)


class PublicUser(BaseModel):
    id: str
    name: str
    email: EmailStr
    username: str
    avatarUrl: str | None = None
    plan: Literal["free", "hacker", "pro"] = "free"


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: PublicUser
