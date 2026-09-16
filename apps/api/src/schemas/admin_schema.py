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


class AdminCPUStats(BaseModel):
    percent: float = 0.0
    logical_cores: int = 1
    physical_cores: int = 1


class AdminMemoryStats(BaseModel):
    total_bytes: int = 0
    used_bytes: int = 0
    available_bytes: int = 0
    percent: float = 0.0


class AdminDiskStats(BaseModel):
    total_bytes: int = 0
    used_bytes: int = 0
    free_bytes: int = 0
    percent: float = 0.0
    path: str = ""


class AdminSystemResources(BaseModel):
    cpu: AdminCPUStats = Field(default_factory=AdminCPUStats)
    memory: AdminMemoryStats = Field(default_factory=AdminMemoryStats)
    disk: AdminDiskStats = Field(default_factory=AdminDiskStats)


class AdminStatsResponse(BaseModel):
    total_users: int
    total_workspaces: int
    total_sessions: int
    total_messages: int
    total_models: int
    active_models: int
    docker: AdminDockerHealth
    mongo: AdminMongoHealth
    system_resources: AdminSystemResources | None = None
    environment: dict[str, Any] = Field(default_factory=dict)


AdminSystemStatsResponse = AdminStatsResponse


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


class AdminSandboxConfigResponse(BaseModel):
    memory_limit_mb: int = 2048
    cpu_limit: float = 2.0
    pids_limit: int = 500
    memory_swap_limit_mb: int = -1


class AdminUpdateSandboxConfigRequest(BaseModel):
    memory_limit_mb: int | None = None
    cpu_limit: float | None = None
    pids_limit: int | None = None
    memory_swap_limit_mb: int | None = None
    apply_to_running: bool = False

