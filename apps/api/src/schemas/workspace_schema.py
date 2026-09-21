from pydantic import BaseModel

from src.models.workspace_model import Workspace


class MinimalSession(BaseModel):
    id: str
    title: str = ""


class WorkspaceWithSession(Workspace):
    sessions: list[MinimalSession]


class WorkspaceResponse(BaseModel):
    workspaces: list[Workspace]


class GetAllWorkspacesResponse(BaseModel):
    workspaces: list[WorkspaceWithSession]


class CreateWorkspaceRequest(BaseModel):
    prompt: str


class CreateWorkspaceResponse(BaseModel):
    workspace_id: str
    redirect_url: str
    workspace_name: str
    workspace: Workspace


class UpdateFileContentRequest(BaseModel):
    path: str
    content: str


class CreateFileRequest(BaseModel):
    path: str
    type: str = "file"
    content: str = ""


class RenameFileRequest(BaseModel):
    old_path: str
    new_path: str

