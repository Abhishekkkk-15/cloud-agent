from src.dependency.auth_dependency import CurrentUser
# from src.schemas.workspace_schema import 
from src.models.workspace_model import Workspace
from src.schemas.workspace_schema import GetAllWorkspacesResponse, WorkspaceWithSession,MinimalSession, CreateWorkspaceRequest
from src.repository.workspace_repository import WorkspaceRepo
from src.repository.session_repository import SessionRepository
from fastapi import  HTTPException, status
from collections import defaultdict

async def create_workspace(body:CreateWorkspaceRequest,current_user: CurrentUser,repo:WorkspaceRepo,):
    if not current_user.id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authorized"
        )
    # Generate workspace title using user query
    workspace_obj = Workspace(title=body.prompt,user_id=current_user.id,target_path="/app",source_path="/",initial_prompt=body.prompt)
    workspace = repo.create(workspace_obj)
    return workspace

    
    

async def get_all_workspace(
    current_user: CurrentUser,
    repo: WorkspaceRepo,
    session_repo: SessionRepository,
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
        workspace.id
        for workspace in all_workspaces
        if workspace.id
    ]

    sessions = await session_repo.find_by_workspace_ids(
        workspace_ids
    )

    sessions_by_workspace: dict[str, list] = defaultdict(list)

    for session in sessions:
        if session.workspace_id:
            sessions_by_workspace[
                session.workspace_id
            ].append(session)

    return [
        WorkspaceWithSession(
            **workspace.model_dump(),
            sessions=sessions_by_workspace.get(
                workspace.id,
                [],
            ),
        )
        for workspace in all_workspaces
    ]
    
      
    
async def get_workspace_details(current_user: CurrentUser,repo:WorkspaceRepo,session_repo:SessionRepository, w_id:str|None=None) -> WorkspaceWithSession:
    if not w_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="w_id is required"
        )
    user_id = current_user.id
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="user is not authenticated"
        )
    workspace = await repo.find_by_id(w_id)
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="workspace not found"
        )
    all_sessions = await session_repo.find_by_workspace_ids([workspace.id])
    if not all_sessions :
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sessions not found for this workspace"
        )
        
    return WorkspaceWithSession(
        **workspace.model_dump(),
        sessions=[
             MinimalSession(
            _id=session.id,
            title=session.title,
        )
            for session in all_sessions
        ],
    )   
    
    
    
