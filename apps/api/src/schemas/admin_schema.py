from typing import Any, Literal
from pydantic import BaseModel, Field


class AdminUserResponse(BaseModel):
    id: str
    name: str
    email: str
    username: str
    avatarUrl: str | None = None
    plan: Literal["free", "hacker", "pro"]
    role: Literal["user", "admin"]
    is_active: bool
    is_verified: bool
    githubConnected: bool
    githubLogin: str | None = None
    created_at: str | None = None
    workspaces_count: int = 0
    sessions_count: int = 0


class AdminUserListResponse(BaseModel):
    users: list[AdminUserResponse]
    total: int


class AdminUpdateRoleRequest(BaseModel):
    role: Literal["user", "admin"]


class AdminUpdatePlanRequest(BaseModel):
    plan: Literal["free", "hacker", "pro"]


class AdminUpdateStatusRequest(BaseModel):
    is_active: bool


class AdminWorkspaceResponse(BaseModel):
    id: str
    title: str
    user_id: str
    user_name: str | None = None
    user_email: str | None = None
    target_path: str
    sandbox_id: str | None = None
    status: str
    frontend_port: int | None = None
    backend_port: int | None = None
    preview_url: str | None = None
    github_repo_full_name: str | None = None
    workspace_origin: str | None = None
    created_at: str | None = None
    sessions_count: int = 0


class AdminWorkspaceListResponse(BaseModel):
    workspaces: list[AdminWorkspaceResponse]
    total: int


class AdminContainerResponse(BaseModel):
    id: str
    short_id: str
    name: str
    image: str
    status: str
    state: str | None = None
    created: str | None = None
    ports: dict[str, Any] = Field(default_factory=dict)
    workspace_id: str | None = None


class AdminContainerListResponse(BaseModel):
    docker_available: bool
    docker_error: str | None = None
    containers: list[AdminContainerResponse]


class AdminContainerLogsResponse(BaseModel):
    container_id: str
    logs: str


class AdminDockerHealth(BaseModel):
    status: Literal["online", "offline"]
    version: str | None = None
    containers_count: int = 0
    running_containers_count: int = 0
    error: str | None = None


class AdminMongoHealth(BaseModel):
    status: Literal["connected", "disconnected"]
    ping_ms: float = 0.0
    error: str | None = None


class AdminStatsResponse(BaseModel):
    total_users: int
    total_workspaces: int
    total_sessions: int
    total_messages: int
    total_models: int
    active_models: int
    docker: AdminDockerHealth
    mongo: AdminMongoHealth
    environment: dict[str, Any] = Field(default_factory=dict)


class AdminAgentConfigResponse(BaseModel):
    default_model_id: str | None = None
    default_effort: Literal["low", "medium", "high"] = "high"
    autonomous_mode: bool = True
    max_retries: int = 3
    compaction_enabled: bool = True
    compact_at_tokens: int = 20000
    keep_recent_tokens: int = 6000
    system_prompt_prefix: str | None = None


class AdminUpdateAgentConfigRequest(BaseModel):
    default_model_id: str | None = None
    default_effort: Literal["low", "medium", "high"] | None = None
    autonomous_mode: bool | None = None
    max_retries: int | None = None
    compaction_enabled: bool | None = None
    compact_at_tokens: int | None = None
    keep_recent_tokens: int | None = None
    system_prompt_prefix: str | None = None

