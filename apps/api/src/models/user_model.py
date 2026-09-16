from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class User(BaseModel):
    id: str | None = None
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    username: str = Field(min_length=1, max_length=80)
    password: str | None = None
    google_id: str | None = None
    avatar_url: str | None = None
    plan: Literal["free", "hacker", "pro"] = "free"
    role: Literal["user", "admin"] = "user"
    is_active: bool = True
    is_verified: bool = False
    github_id: str | None = None
    github_login: str | None = None
    github_avatar_url: str | None = None
    github_access_token_enc: str | None = None
    github_connected_at: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
