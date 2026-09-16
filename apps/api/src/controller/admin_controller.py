from typing import Annotated, Any
from bson import ObjectId
from fastapi import Depends, HTTPException, Query, status

from src.deps import CurrentAdmin
from src.repository.message_repository import MessageRepo
from src.repository.model_repository import ModelRepo
from src.repository.session_repository import SessionRepo
from src.repository.settings_repository import SettingsRepo
from src.repository.user_repository import UserRepo
from src.repository.workspace_repository import WorkspaceRepo
from src.schemas.admin_schema import (
    AdminAgentConfigResponse,
    AdminContainerListResponse,
    AdminContainerLogsResponse,
    AdminStatsResponse,
    AdminUpdateAgentConfigRequest,
    AdminUpdatePlanRequest,
    AdminUpdateRoleRequest,
    AdminUpdateStatusRequest,
    AdminUserListResponse,
    AdminUserResponse,
    AdminWorkspaceListResponse,
    AdminWorkspaceResponse,
)
from src.services.admin_service import AdminService
from src.utils.db_client import get_db


async def get_system_stats(
    admin: CurrentAdmin,
    user_repo: UserRepo,
    workspace_repo: WorkspaceRepo,
    session_repo: SessionRepo,
    message_repo: MessageRepo,
    model_repo: ModelRepo,
    db: Annotated[Any, Depends(get_db)],
) -> AdminStatsResponse:
    stats = await AdminService.get_system_stats(
        user_repo=user_repo,
        workspace_repo=workspace_repo,
        session_repo=session_repo,
        message_repo=message_repo,
        model_repo=model_repo,
        db=db,
    )
    return AdminStatsResponse(**stats)


async def list_containers(
    admin: CurrentAdmin,
) -> AdminContainerListResponse:
    res = AdminService.get_containers()
    return AdminContainerListResponse(**res)


async def start_container(
    container_id: str,
    admin: CurrentAdmin,
) -> dict[str, Any]:
    try:
        return AdminService.start_container(container_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


async def stop_container(
    container_id: str,
    admin: CurrentAdmin,
) -> dict[str, Any]:
    try:
        return AdminService.stop_container(container_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


async def restart_container(
    container_id: str,
    admin: CurrentAdmin,
) -> dict[str, Any]:
    try:
        return AdminService.restart_container(container_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


async def remove_container(
    container_id: str,
    admin: CurrentAdmin,
) -> dict[str, Any]:
    try:
        return AdminService.remove_container(container_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


async def get_container_logs(
    container_id: str,
    admin: CurrentAdmin,
    tail: int = Query(default=150, ge=10, le=1000),
) -> AdminContainerLogsResponse:
    try:
        logs_text = AdminService.get_container_logs(container_id, tail=tail)
        return AdminContainerLogsResponse(container_id=container_id, logs=logs_text)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


async def prune_containers(
    admin: CurrentAdmin,
) -> dict[str, Any]:
    try:
        return AdminService.prune_containers()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


async def list_users(
    admin: CurrentAdmin,
    user_repo: UserRepo,
    workspace_repo: WorkspaceRepo,
    session_repo: SessionRepo,
    search: str | None = Query(default=None),
    role: str | None = Query(default=None),
    plan: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    skip: int = Query(default=0, ge=0),
) -> AdminUserListResponse:
    users = await user_repo.find_all(search=search, role=role, plan=plan, limit=limit, skip=skip)
    total = await user_repo.count_total()

    # Enrich users with workspace counts
    enriched = []
    for u in users:
        workspaces = await workspace_repo.find_by_user(u.id or "") if u.id else []
        ws_count = len(workspaces)
        
        # Count total sessions across user's workspaces
        sessions_count = 0
        for ws in workspaces:
            if ws.id:
                sessions_count += await session_repo.count_total({"workspace_id": ws.id})

        enriched.append(
            AdminUserResponse(
                id=u.id or "",
                name=u.name,
                email=u.email,
                username=u.username,
                avatarUrl=u.avatar_url,
                plan=u.plan,
                role=u.role,
                is_active=u.is_active,
                is_verified=u.is_verified,
                githubConnected=bool(u.github_access_token_enc),
                githubLogin=u.github_login,
                created_at=u.created_at.isoformat() if u.created_at else None,
                workspaces_count=ws_count,
                sessions_count=sessions_count,
            )
        )

    return AdminUserListResponse(users=enriched, total=total)


async def update_user_role(
    user_id: str,
    body: AdminUpdateRoleRequest,
    admin: CurrentAdmin,
    user_repo: UserRepo,
) -> dict[str, Any]:
    if user_id == admin.id and body.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot demote yourself from admin",
        )
    ok = await user_repo.update_role(user_id, body.role)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return {"success": True, "user_id": user_id, "role": body.role}


async def update_user_plan(
    user_id: str,
    body: AdminUpdatePlanRequest,
    admin: CurrentAdmin,
    user_repo: UserRepo,
) -> dict[str, Any]:
    ok = await user_repo.update_plan(user_id, body.plan)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return {"success": True, "user_id": user_id, "plan": body.plan}


async def update_user_status(
    user_id: str,
    body: AdminUpdateStatusRequest,
    admin: CurrentAdmin,
    user_repo: UserRepo,
) -> dict[str, Any]:
    if user_id == admin.id and not body.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate yourself",
        )
    ok = await user_repo.update_status(user_id, body.is_active)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return {"success": True, "user_id": user_id, "is_active": body.is_active}


async def delete_user(
    user_id: str,
    admin: CurrentAdmin,
    user_repo: UserRepo,
) -> dict[str, Any]:
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete yourself",
        )
    ok = await user_repo.delete(user_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return {"success": True, "deleted_id": user_id}


async def list_workspaces(
    admin: CurrentAdmin,
    workspace_repo: WorkspaceRepo,
    user_repo: UserRepo,
    session_repo: SessionRepo,
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    skip: int = Query(default=0, ge=0),
) -> AdminWorkspaceListResponse:
    workspaces = await workspace_repo.find_all_admin(
        search=search, status=status, limit=limit, skip=skip
    )
    total = await workspace_repo.count_total()

    # User lookup cache to avoid repeated queries
    user_cache: dict[str, Any] = {}
    enriched = []

    for ws in workspaces:
        u_name = None
        u_email = None
        if ws.user_id:
            if ws.user_id not in user_cache:
                u = await user_repo.find_by_id(ws.user_id)
                user_cache[ws.user_id] = u
            u = user_cache.get(ws.user_id)
            if u:
                u_name = u.name
                u_email = u.email

        sessions_count = await session_repo.count_total({"workspace_id": ws.id}) if ws.id else 0

        enriched.append(
            AdminWorkspaceResponse(
                id=ws.id or "",
                title=ws.title,
                user_id=ws.user_id,
                user_name=u_name,
                user_email=u_email,
                target_path=ws.target_path,
                sandbox_id=ws.sandbox_id,
                status=ws.status.value if hasattr(ws.status, "value") else str(ws.status),
                frontend_port=ws.frontend_port,
                backend_port=ws.backend_port,
                preview_url=ws.preview_url,
                github_repo_full_name=ws.github_repo_full_name,
                workspace_origin=ws.workspace_origin,
                created_at=ws.created_at.isoformat() if ws.created_at else None,
                sessions_count=sessions_count,
            )
        )

    return AdminWorkspaceListResponse(workspaces=enriched, total=total)


async def stop_workspace(
    workspace_id: str,
    admin: CurrentAdmin,
    workspace_repo: WorkspaceRepo,
) -> dict[str, Any]:
    ws = await workspace_repo.find_by_id(workspace_id)
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    
    if ws.sandbox_id:
        try:
            AdminService.stop_container(ws.sandbox_id)
        except Exception:
            pass

    from src.models.workspace_model import WorkspaceStatus
    ws.status = WorkspaceStatus.FAILED  # or stopped
    await workspace_repo.save(ws)
    return {"success": True, "workspace_id": workspace_id, "status": "stopped"}


async def delete_workspace(
    workspace_id: str,
    admin: CurrentAdmin,
    workspace_repo: WorkspaceRepo,
    session_repo: SessionRepo,
) -> dict[str, Any]:
    ws = await workspace_repo.find_by_id(workspace_id)
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    if ws.sandbox_id:
        try:
            AdminService.remove_container(ws.sandbox_id, force=True)
        except Exception:
            pass

    await session_repo.delete_by_workspace(workspace_id)
    await workspace_repo.delete(workspace_id)
    return {"success": True, "deleted_id": workspace_id}


async def get_agent_config(
    admin: CurrentAdmin,
    settings_repo: SettingsRepo,
) -> AdminAgentConfigResponse:
    cfg = await AdminService.get_agent_config(settings_repo)
    return AdminAgentConfigResponse(**cfg)


async def update_agent_config(
    body: AdminUpdateAgentConfigRequest,
    admin: CurrentAdmin,
    settings_repo: SettingsRepo,
) -> AdminAgentConfigResponse:
    updates = body.model_dump(exclude_unset=True)
    updated = await AdminService.update_agent_config(settings_repo, updates)
    return AdminAgentConfigResponse(**updated)

