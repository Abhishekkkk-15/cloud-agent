from fastapi import APIRouter, status

from src.controller.workspace_controller import (
    create_workspace,
    delete_workspace,
    get_all_workspace,
    get_workspace_details,
    update_workspace,
)
from src.models.workspace_model import Workspace
from src.schemas.workspace_schema import (
    CreateWorkspaceRequest,
    CreateWorkspaceResponse,
    WorkspaceWithSession,
)

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])

router.get("", response_model=list[WorkspaceWithSession])(get_all_workspace)
router.get("/{workspace_id}", response_model=WorkspaceWithSession)(
    get_workspace_details
)
router.post(
    "/new",
    response_model=CreateWorkspaceResponse,
    status_code=status.HTTP_201_CREATED,
)(create_workspace)
router.put("/{workspace_id}", response_model=WorkspaceWithSession)(update_workspace)
router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)(
    delete_workspace
)
