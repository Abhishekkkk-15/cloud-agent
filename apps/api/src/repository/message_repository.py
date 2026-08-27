from pymongo import ASCENDING
from pymongo.asynchronous.collection import AsyncCollection
from fastapi import Depends
from typing import Annotated, Any
from src.utils.db_client import get_db
from src.models.pi_sdk_models import MongoMessageDocument


class MessageRepository:
    def __init__(self, collection: AsyncCollection):
        self.collection = collection

    async def create(
        self,
        message: MongoMessageDocument,
    ) -> MongoMessageDocument:

        await self.collection.insert_one(
            message.model_dump()
        )

        return message

    async def get_next_seq(
        self,
        session_id: str,
    ) -> int:

        doc = await self.collection.find_one(
            {"session_id": session_id},
            sort=[("seq", -1)],
        )

        return 0 if doc is None else doc["seq"] + 1

    async def append(
        self,
        session_id: str,
        message: MongoMessageDocument,
    ) -> MongoMessageDocument:

        message.seq = await self.get_next_seq(
            session_id
        )

        await self.create(message)

        return message

    async def find_by_session(
        self,
        session_id: str,
    ) -> list[MongoMessageDocument]:

        cursor = self.collection.find(
            {"session_id": session_id}
        ).sort("seq", ASCENDING)

        docs = await cursor.to_list(length=None)

        return [
            MongoMessageDocument(
                **{k: v for k, v in doc.items() if k != "_id"}
            )
            for doc in docs
        ]

    async def get_last_message(
        self,
        session_id: str,
    ) -> MongoMessageDocument | None:

        doc = await self.collection.find_one(
            {"session_id": session_id},
            sort=[("seq", -1)],
        )

        return (
            MongoMessageDocument(**doc)
            if doc
            else None
        )

    async def delete_by_session(
        self,
        session_id: str,
    ) -> int:

        result = await self.collection.delete_many(
            {"session_id": session_id}
        )

        return result.deleted_count

async def get_message_repo(db: Annotated[Any, Depends(get_db)]) -> MessageRepository:
    return MessageRepository(db["messages"])

MessageRepo = Annotated[MessageRepository, Depends(get_message_repo)]