from collections import defaultdict

from fastapi import HTTPException, status
from pymongo.errors import WriteError

from src.dependency.auth_dependency import CurrentUser
from src.models.workspace_model import Workspace
from src.repository.session_repository import SessionRepo
from src.repository.workspace_repository import WorkspaceRepo
from src.schemas.workspace_schema import (
    CreateWorkspaceRequest,
    CreateWorkspaceResponse,
    MinimalSession,
    WorkspaceWithSession,
)


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
        workspace_obj = Workspace(
            title=body.prompt,
            user_id=current_user.id,
            target_path="/app",
            source_path="/",
            initial_prompt=body.prompt,
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

    if workspace.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="forbidden",
        )

    all_sessions = await session_repo.find_by_workspace_ids([workspace.id])

    return WorkspaceWithSession(
        **workspace.model_dump(),
        sessions=_to_minimal_sessions(all_sessions),
    )
