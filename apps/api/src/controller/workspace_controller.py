from collections import defaultdict
import re
import shutil

from fastapi import HTTPException, status
from fastapi.responses import StreamingResponse
from pymongo.errors import WriteError

from src.ai_core.intent_agent import IntentAgent
from src.controller.github_controller import _require_connected_token
from src.dependency.auth_dependency import CurrentUser
from src.dependency.sandbox_dependency import SandboxRepo
from src.dependency.port_depemdency import PortRepo
from src.models.workspace_model import Workspace
from src.repository.message_repository import MessageRepo
from src.repository.session_repository import SessionRepo
from src.repository.workspace_repository import WorkspaceRepo
from src.schemas.github_schema import ImportGithubWorkspaceRequest
from src.schemas.workspace_schema import (
    CreateFileRequest,
    CreateWorkspaceRequest,
    CreateWorkspaceResponse,
    MinimalSession,
    RenameFileRequest,
    UpdateFileContentRequest,
    WorkspaceWithSession,
)
from src.services.workspace_files_service import (
    WorkspaceFilesError,
    WorkspaceFilesService,
)
from src.utils.config import config
from src.utils.github_oauth import delete_github_repo


def _to_minimal_sessions(sessions) -> list[MinimalSession]:
    return [
        MinimalSession(id=session.id, title=session.title or "")
        for session in sessions
        if session.id
    ]


async def create_workspace(
    body: CreateWorkspaceRequest,
    current_user: CurrentUser,
    repo: WorkspaceRepo,
):
    if not current_user.id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authorized",
        )

    try:
        
        agent = IntentAgent()
        intent = await agent.analyze(body.prompt)
        
        workspace_obj = Workspace(
            title=intent.title,
            user_id=current_user.id,
            target_path="/app",
            source_path="/",
            initial_prompt=body.prompt,
            workspace_origin="template",
        )
        workspace = await repo.create(workspace_obj)

        return CreateWorkspaceResponse(
            workspace_id=workspace.id,
            redirect_url=f"/workspace/{workspace.id}",
            workspace_name=workspace.title,
            workspace=workspace,
        )
    except WriteError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error : [{e}]",
        ) from e


async def import_github_workspace(
    body: ImportGithubWorkspaceRequest,
    current_user: CurrentUser,
    repo: WorkspaceRepo,
):
    if not current_user.id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authorized",
        )

    # User OAuth required for import; clone happens later in prepare_workspace.
    _require_connected_token(current_user)

    expected = f"{body.owner}/{body.name}"
    if body.full_name != expected:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="full_name must match owner/name",
        )

    try:
        workspace_obj = Workspace(
            title=body.full_name,
            user_id=current_user.id,
            target_path="/app",
            source_path="/",
            initial_prompt=f"Imported from {body.html_url}",
            github_repo_full_name=body.full_name,
            github_repo_url=body.html_url,
            github_clone_url=body.clone_url,
            github_default_branch=body.default_branch,
            github_owner=body.owner,
            github_name=body.name,
            github_auth_source="user",
            workspace_origin="github_import",
        )
        workspace = await repo.create(workspace_obj)
        return CreateWorkspaceResponse(
            workspace_id=workspace.id,
            redirect_url=f"/workspace/{workspace.id}",
            workspace_name=workspace.title,
            workspace=workspace,
        )
    except WriteError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error : [{e}]",
        ) from e


async def get_all_workspace(
    current_user: CurrentUser,
    repo: WorkspaceRepo,
    session_repo: SessionRepo,
) -> list[WorkspaceWithSession]:
    user_id = current_user.id

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="user is not authenticated",
        )

    all_workspaces = await repo.find_by_user(user_id)

    if not all_workspaces:
        return []

    workspace_ids = [
        workspace.id for workspace in all_workspaces if workspace.id
    ]

    sessions = await session_repo.find_by_workspace_ids(workspace_ids)

    sessions_by_workspace: dict[str, list] = defaultdict(list)

    for session in sessions:
        workspace_id = session.workspace_id
        if workspace_id:
            sessions_by_workspace[str(workspace_id)].append(session)

    return [
        WorkspaceWithSession(
            **workspace.model_dump(),
            sessions=_to_minimal_sessions(
                sessions_by_workspace.get(str(workspace.id), [])
            ),
        )
        for workspace in all_workspaces
    ]


async def get_workspace_details(
    workspace_id: str,
    current_user: CurrentUser,
    repo: WorkspaceRepo,
    session_repo: SessionRepo,
) -> WorkspaceWithSession:
    user_id = current_user.id
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="user is not authenticated",
        )

    workspace = await repo.find_by_id(workspace_id)
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="workspace not found",
        )

    is_admin = getattr(current_user, "role", "") == "admin"
    if workspace.user_id != user_id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="forbidden",
        )

    all_sessions = await session_repo.find_by_workspace_ids([workspace.id])

    return WorkspaceWithSession(
        **workspace.model_dump(),
        sessions=_to_minimal_sessions(all_sessions),
    )


async def update_workspace(
    workspace_id: str,
    body: Workspace,
    current_user: CurrentUser,
    repo: WorkspaceRepo,
    session_repo: SessionRepo,
) -> WorkspaceWithSession:
    if not current_user.id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="user is not authenticated",
        )

    existing = await repo.find_by_id(workspace_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="workspace not found",
        )
    if existing.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="forbidden",
        )

    if body.title.strip():
        existing.title = body.title.strip()

    updated = await repo.save(existing)
    sessions = await session_repo.find_by_workspace_ids([workspace_id])

    return WorkspaceWithSession(
        **updated.model_dump(),
        sessions=_to_minimal_sessions(sessions),
    )


async def delete_workspace(
    workspace_id: str,
    current_user: CurrentUser,
    repo: WorkspaceRepo,
    session_repo: SessionRepo,
    message_repo: MessageRepo,
    sandbox_repo: SandboxRepo,
    port_manager: PortRepo,
):
    if not current_user.id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="user is not authenticated",
        )

    existing = await repo.find_by_id(workspace_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="workspace not found",
        )
    if existing.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="forbidden",
        )

    # 1. Stop & remove Docker sandbox container and release workspace ports
    if existing.sandbox_id:
        try:
            sandbox_repo.stop_sandbox(existing.sandbox_id)
            sandbox_repo.delete_sandbox(existing.sandbox_id)
        except Exception as e:
            print(f"[Workspace Cleanup] Error removing container {existing.sandbox_id}: {e}")

    try:
        port_manager.release_workspace_ports(workspace_id)
    except Exception as e:
        print(f"[Workspace Cleanup] Error releasing ports for {workspace_id}: {e}")

    # 2. Remove mount workspace directory from host disk
    try:
        workspace_dir = config.workspace_base / workspace_id
        if workspace_dir.exists():
            shutil.rmtree(workspace_dir, ignore_errors=True)
    except Exception as e:
        print(f"[Workspace Cleanup] Error removing workspace directory: {e}")

    # 3. If repo was created under our default platform GitHub credentials, delete it from GitHub
    platform_token = (config.GITHUB_DEFAULT_TOKEN or "").strip()
    platform_login = (config.GITHUB_DEFAULT_LOGIN or "").strip()
    if (
        platform_token
        and platform_login
        and existing.github_auth_source == "platform"
        and existing.github_repo_owner == platform_login
        and existing.github_repo_name
    ):
        try:
            await delete_github_repo(platform_token, existing.github_repo_owner, existing.github_repo_name)
        except Exception as e:
            print(f"[Workspace Cleanup] Error deleting platform GitHub repo: {e}")

    # 4. Delete chat messages and sessions
    sessions = await session_repo.find_by_workspace_ids([workspace_id])
    for session in sessions:
        if session.id:
            await message_repo.delete_by_session(session.id)

    await session_repo.delete_by_workspace(workspace_id)

    # 5. Delete workspace record from DB
    deleted = await repo.delete(workspace_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="workspace not found",
        )


async def _get_authorized_workspace(
    workspace_id: str,
    current_user: CurrentUser,
    repo: WorkspaceRepo,
) -> Workspace:
    if not current_user.id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authorized",
        )
    workspace = await repo.find_by_id(workspace_id)
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )
    if workspace.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden",
        )
    return workspace


async def get_workspace_file_tree(
    workspace_id: str,
    current_user: CurrentUser,
    repo: WorkspaceRepo,
):
    await _get_authorized_workspace(workspace_id, current_user, repo)
    service = WorkspaceFilesService(workspace_id)
    try:
        files = service.get_tree()
        return {"files": files}
    except WorkspaceFilesError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


async def get_workspace_file_content(
    workspace_id: str,
    path: str,
    current_user: CurrentUser,
    repo: WorkspaceRepo,
):
    await _get_authorized_workspace(workspace_id, current_user, repo)
    service = WorkspaceFilesService(workspace_id)
    try:
        return service.get_content(path)
    except WorkspaceFilesError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


async def save_workspace_file_content(
    workspace_id: str,
    body: UpdateFileContentRequest,
    current_user: CurrentUser,
    repo: WorkspaceRepo,
):
    await _get_authorized_workspace(workspace_id, current_user, repo)
    service = WorkspaceFilesService(workspace_id)
    try:
        return service.save_content(body.path, body.content)
    except WorkspaceFilesError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


async def create_workspace_file(
    workspace_id: str,
    body: CreateFileRequest,
    current_user: CurrentUser,
    repo: WorkspaceRepo,
):
    await _get_authorized_workspace(workspace_id, current_user, repo)
    service = WorkspaceFilesService(workspace_id)
    try:
        return service.create_item(body.path, item_type=body.type, content=body.content)
    except WorkspaceFilesError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


async def delete_workspace_file(
    workspace_id: str,
    path: str,
    current_user: CurrentUser,
    repo: WorkspaceRepo,
):
    await _get_authorized_workspace(workspace_id, current_user, repo)
    service = WorkspaceFilesService(workspace_id)
    try:
        return service.delete_item(path)
    except WorkspaceFilesError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


async def rename_workspace_file(
    workspace_id: str,
    body: RenameFileRequest,
    current_user: CurrentUser,
    repo: WorkspaceRepo,
):
    await _get_authorized_workspace(workspace_id, current_user, repo)
    service = WorkspaceFilesService(workspace_id)
    try:
        return service.rename_item(body.old_path, body.new_path)
    except WorkspaceFilesError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


async def download_workspace_zip(
    workspace_id: str,
    current_user: CurrentUser,
    repo: WorkspaceRepo,
):
    workspace = await _get_authorized_workspace(workspace_id, current_user, repo)
    service = WorkspaceFilesService(workspace_id)
    try:
        buffer = service.create_zip_buffer()
        raw_title = workspace.title or "workspace"
        safe_title = re.sub(r"[^a-zA-Z0-9_\-]", "_", raw_title)
        safe_title = re.sub(r"_+", "_", safe_title).strip("_") or "project"
        filename = f"{safe_title}.zip"

        return StreamingResponse(
            buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Type": "application/zip",
            },
        )
    except WorkspaceFilesError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)



