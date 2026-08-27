from typing import Annotated, Any

from bson import ObjectId
from fastapi import Depends
from pymongo.asynchronous.collection import AsyncCollection

from src.models.workspace_model import Workspace, WorkspaceStatus
from src.utils.db_client import get_db


def _doc_to_workspace(doc: dict) -> Workspace:
    extras: dict = {}
    if doc.get("created_at"):
        extras["created_at"] = doc["created_at"]
    if doc.get("updated_at"):
        extras["updated_at"] = doc["updated_at"]

    status = doc.get("status", WorkspaceStatus.PENDING)
    if isinstance(status, str):
        status = WorkspaceStatus(status)

    return Workspace(
        id=str(doc["_id"]),
        title=doc["title"],
        user_id=doc["user_id"],
        target_path=doc["target_path"],
        source_path=doc.get("source_path"),
        sandbox_id=doc.get("sandbox_id"),
        is_active=doc.get("is_active", True),
        initial_prompt=doc.get("initial_prompt", ""),
        status=status,
        **extras,
    )


class WorkspaceRepository:
    def __init__(self, collection: AsyncCollection):
        self.collection = collection

    async def create(self, workspace: Workspace) -> Workspace:
        data = workspace.model_dump(exclude={"id"})
        result = await self.collection.insert_one(data)
        workspace.id = str(result.inserted_id)
        return workspace

    async def find_by_user(self, id: str) -> list[Workspace]:
        cursor = self.collection.find({"user_id": id})
        docs = await cursor.to_list(length=None)
        return [_doc_to_workspace(doc) for doc in docs]

    async def find_by_id(self, id: str) -> Workspace | None:
        if not ObjectId.is_valid(id):
            return None
        doc = await self.collection.find_one({"_id": ObjectId(id)})
        return _doc_to_workspace(doc) if doc else None

    async def save(self, workspace: Workspace) -> Workspace:
        if not workspace.id or not ObjectId.is_valid(workspace.id):
            return await self.create(workspace)
        data = workspace.model_dump(exclude={"id"})
        await self.collection.update_one(
            {"_id": ObjectId(workspace.id)},
            {"$set": data},
        )
        return workspace


async def get_workspace_repo(db: Annotated[Any, Depends(get_db)]) -> WorkspaceRepository:
    return WorkspaceRepository(db["workspaces"])


WorkspaceRepo = Annotated[WorkspaceRepository, Depends(get_workspace_repo)]
