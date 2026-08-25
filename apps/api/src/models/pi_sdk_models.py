from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class MessageRole(str, Enum):
    USER = "user"
    SYSTEM = "system"
    TOOL = "tool"
    ASSISTANT = "assistant"


class SessionPermissions(BaseModel):
    allow_all: bool = False
    allowed_tools: list[str] = Field(default_factory=list)
    # tool_name -> list of allowed target keys
    allowed_targets: dict[str, list[str]] = Field(default_factory=dict)


class MongoSessionDocument(BaseModel):
    """Collection: `sessions` — `_id` is the session id."""

    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(alias="_id")
    title: str = ""
    workspace: str  # host cwd path
    permissions: SessionPermissions = Field(default_factory=SessionPermissions)
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cached_tokens: int = 0
    estimated_cost_usd: float = 0.0
    compaction_summary: str = ""
    compacted_until: int = 0
    user_id: str | None = None
    workspace_id: str | None = None  # your Workspace entity id
    created_at: str | None = None  # ISO-8601 UTC
    updated_at: str | None = None  # ISO-8601 UTC


class MongoMessageDocument(BaseModel):
    """Collection: `messages` — unique index on (session_id, seq)."""

    session_id: str
    seq: int  # 0-based order within the session
    role: MessageRole | str
    content: str = ""
    user_id: str | None = None
    name: str | None = None
    tool_calls: list[Any] | None = None
    tool_call_id: str | None = None
    reasoning_content: str | None = None