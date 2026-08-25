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
    is_active: bool = True
    is_verified: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
