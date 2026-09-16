from typing import Any
from fastapi import APIRouter, Query, status

from src.controller.admin_controller import (
    delete_user,
    delete_workspace,
    get_agent_config,
    get_container_logs,
    get_cost_analytics,
    get_sandbox_config,
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
    update_agent_config,
    update_plan_budgets,
    update_sandbox_config,
    update_user_plan,
    update_user_role,
    update_user_status,
)
from src.schemas.admin_schema import (
    AdminAgentConfigResponse,
    AdminCostAnalyticsResponse,
    AdminSandboxConfigResponse,
    AdminContainerListResponse,
    AdminContainerLogsResponse,
    AdminStatsResponse,
    AdminUserListResponse,
    AdminWorkspaceListResponse,
    PlanBudgetConfig,
)

router = APIRouter(prefix="/admin", tags=["Admin"])

# Agent Configuration
router.get("/agent-config", response_model=AdminAgentConfigResponse)(get_agent_config)
router.put("/agent-config", response_model=AdminAgentConfigResponse)(update_agent_config)

# Sandbox Container Configuration
router.get("/sandbox-config", response_model=AdminSandboxConfigResponse)(get_sandbox_config)
router.put("/sandbox-config", response_model=AdminSandboxConfigResponse)(update_sandbox_config)

# Token & Cost Analytics & Monthly Budgets
router.get("/costs", response_model=AdminCostAnalyticsResponse)(get_cost_analytics)
router.put("/plan-budgets", response_model=PlanBudgetConfig)(update_plan_budgets)

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

