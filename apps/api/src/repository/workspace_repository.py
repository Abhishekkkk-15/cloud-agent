from src.models.workspace_model import Workspace
from pymongo.asynchronous.collection import AsyncCollection
from bson import ObjectId
from fastapi import Depends
from typing import Annotated, Any
from src.utils.db_client import get_db

def _doc_to_workspace(doc:Workspace)->Workspace:
    extras: dict = {}
    if doc.get("created_at"):
        extras["created_at"] = doc["created_at"]
    if doc.get("updated_at"):
        extras["updated_at"] = doc["updated_at"]
    return Workspace(
        id=str(doc["_id"]),
        title= doc["title"],
        user_id = doc["user_id"],
        target_path = doc["target_path"],     # internal container path
        source_path = doc["source_path"],     # host mount path    
        sandbox_id = doc["sandbox_id"],              # Cotainer id
        is_active= doc["is_active"],
        **extras
    )


class WorkspaceRepository:
    def __init__(self, collection:AsyncCollection):
        self.collection = collection

    async def create(self, workspace:Workspace)-> Workspace:
        data = workspace.model_dump(exclude={"id"})
        result = await self.collection.insert_one(data)
        result.id = str(result.inserted_id)
        return workspace
    
    async def find_by_user(self,id:str) -> Workspace|None:
        doc = await self.collection.find_one({"user_id":id})
        return _doc_to_workspace(doc) if doc else None
    async def find_by_id(self,id:str) -> Workspace|None:
        doc = await self.collection.get(id)
        return _doc_to_workspace(doc) if doc else None
    
    async def save(self,workspace:Workspace) -> Workspace:
        if not workspace.id or not ObjectId.is_valid(workspace.id):
            return await self.create(workspace)
        data = workspace.model_dump()
        await self.collection.update_one({"_id":ObjectId(workspace.id)},{"$set":data})
        return workspace


async def get_workspace_repo(db:Annotated[Any, Depends(get_db)]) -> WorkspaceRepository:
    return WorkspaceRepository(db["workspaces"])

WorkspaceRepo = Annotated[WorkspaceRepository, Depends[get_workspace_repo]]
    
