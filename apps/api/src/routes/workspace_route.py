from fastapi import APIRouter, status

from src.controller.workspace_controller import (
    create_workspace,
    create_workspace_file,
    delete_workspace,
    delete_workspace_file,
    download_workspace_zip,
    get_all_workspace,
    get_workspace_details,
    get_workspace_file_content,
    get_workspace_file_tree,
    import_github_workspace,
    rename_workspace_file,
    save_workspace_file_content,
    update_workspace,
)
from src.schemas.workspace_schema import (
    CreateWorkspaceResponse,
    WorkspaceWithSession,
)

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])

router.get("", response_model=list[WorkspaceWithSession])(get_all_workspace)
router.post(
    "/import",
    response_model=CreateWorkspaceResponse,
    status_code=status.HTTP_201_CREATED,
)(import_github_workspace)
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

# File Management Endpoints
router.get("/{workspace_id}/download")(download_workspace_zip)
router.get("/{workspace_id}/files/tree")(get_workspace_file_tree)
router.get("/{workspace_id}/files/content")(get_workspace_file_content)
router.put("/{workspace_id}/files/content")(save_workspace_file_content)
router.post("/{workspace_id}/files", status_code=status.HTTP_201_CREATED)(create_workspace_file)
router.delete("/{workspace_id}/files")(delete_workspace_file)
router.patch("/{workspace_id}/files/rename")(rename_workspace_file)


