from typing import Any
from fastapi import APIRouter, Query, status

from src.controller.admin_controller import (
    delete_user,
    delete_workspace,
    get_container_logs,
    get_system_stats,
    list_containers,
    list_users,
    list_workspaces,
    prune_containers,
    remove_container,
    restart_container,
    start_container,
    stop_container,
    stop_workspace,
    update_user_plan,
    update_user_role,
    update_user_status,
)
from src.schemas.admin_schema import (
    AdminContainerListResponse,
    AdminContainerLogsResponse,
    AdminStatsResponse,
    AdminUserListResponse,
    AdminWorkspaceListResponse,
)

router = APIRouter(prefix="/admin", tags=["Admin"])

# System Stats
router.get("/stats", response_model=AdminStatsResponse)(get_system_stats)

# Docker Containers
router.get("/containers", response_model=AdminContainerListResponse)(list_containers)
router.post("/containers/{container_id}/start")(start_container)
router.post("/containers/{container_id}/stop")(stop_container)
router.post("/containers/{container_id}/restart")(restart_container)
router.delete("/containers/{container_id}")(remove_container)
router.get("/containers/{container_id}/logs", response_model=AdminContainerLogsResponse)(
    get_container_logs
)
router.post("/containers/prune")(prune_containers)

# Users Management
router.get("/users", response_model=AdminUserListResponse)(list_users)
router.patch("/users/{user_id}/role")(update_user_role)
router.patch("/users/{user_id}/plan")(update_user_plan)
router.patch("/users/{user_id}/status")(update_user_status)
router.delete("/users/{user_id}")(delete_user)

# Workspaces Management
router.get("/workspaces", response_model=AdminWorkspaceListResponse)(list_workspaces)
router.post("/workspaces/{workspace_id}/stop")(stop_workspace)
router.delete("/workspaces/{workspace_id}")(delete_workspace)
