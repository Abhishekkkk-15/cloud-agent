from src.models.workspace_model import Workspace

from pydantic import BaseModel, Field

class MinimalSession(BaseModel):
    id: str = Field(alias="_id")
    title: str = ""

class WorkspaceWithSession(Workspace):
    sessions:list[MinimalSession]

class WorkspaceResponse(BaseModel):
    workspaces:list[Workspace]
    
 
    
    
class GetAllWorkspacesResponse(BaseModel):    
    workspaces:WorkspaceWithSession
    
    
    
class CreateWorkspaceRequest(BaseModel):
    prompt:str