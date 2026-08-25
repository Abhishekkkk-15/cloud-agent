from src.models.workspace_model import Workspace
from pymongo.asynchronous.collection import AsyncCollection
from bson import ObjectId
from fastapi import Depends
from typing import Annotated, Any
from src.utils.db_client import get_db
from src.models.pi_sdk_models import MongoSessionDocument
 
def _doc_to_session(doc: dict) -> MongoSessionDocument:
    return MongoSessionDocument(
        _id=str(doc["_id"]),
        title=doc.get("title", ""),
        workspace=doc["workspace"],
        permissions=doc.get("permissions", {}),
        prompt_tokens=doc.get("prompt_tokens", 0),
        completion_tokens=doc.get("completion_tokens", 0),
        total_tokens=doc.get("total_tokens", 0),
        cached_tokens=doc.get("cached_tokens", 0),
        estimated_cost_usd=doc.get("estimated_cost_usd", 0.0),
        compaction_summary=doc.get("compaction_summary", ""),
        compacted_until=doc.get("compacted_until", 0),
        user_id=doc.get("user_id"),
        workspace_id=doc.get("workspace_id"),
        created_at=doc.get("created_at"),
        updated_at=doc.get("updated_at"),
    ) 
 
class SessionRepository:
    def __init__(self,collection:AsyncCollection):
        self.collection = collection
        
    async def create(self,session:MongoSessionDocument)->MongoSessionDocument:
        data = session.model_dump(exclude={"id"},by_alias=False)
        result = await self.collection.insert_one(**data)
        session.id = str(result.inserted_id)
        return session
    
    async def find_by_id(self,id:str)->MongoSessionDocument|None:
        if not ObjectId.is_valid(id):
            return None
        doc = await self.collection.find_one({"_id":ObjectId(id)})
        return _doc_to_session(doc) if doc else None
    
    async def find_by_workspace(self,id:str)->MongoSessionDocument|None:
        if not ObjectId.is_valid(id):
            return None
        doc = await self.collection.find_one({"workspace_id":ObjectId(id)})
        return _doc_to_session(doc) if doc else None
    
    async def find_by_user(
        self,
        user_id: str,
    ) -> list[MongoSessionDocument]:

        cursor = self.collection.find(
            {"user_id": user_id}
        )

        docs = await cursor.to_list(length=None)

        return [_doc_to_session(doc) for doc in docs]
    
    async def find_by_workspace_ids(
    self,
    workspace_ids: list[str],
    ) -> list[MongoSessionDocument]:
    
        cursor = self.collection.find(
            {
                "workspace_id": {
                    "$in": workspace_ids
                }
            }
        )
    
        docs = await cursor.to_list(length=None)
    
        return [_doc_to_session(doc) for doc in docs]
        
    
    async def save(
        self,
        session: MongoSessionDocument,
    ) -> MongoSessionDocument:

        if not session.id:
            return await self.create(session)

        data = session.model_dump(
            exclude={"id"},
            by_alias=False,
        )

        await self.collection.update_one(
            {"_id": ObjectId(session.id)},
            {"$set": data},
        )

        return session

    async def delete(
        self,
        session_id: str,
    ) -> bool:

        result = await self.collection.delete_one(
            {"_id": ObjectId(session_id)}
        )

        return result.deleted_count > 0
    

async def get_session_repo(db:Annotated[Any, Depends(get_db)]) -> SessionRepository:
    return SessionRepository(db["sessions"])

WorkspaceRepo = Annotated[SessionRepository, Depends(get_session_repo)]