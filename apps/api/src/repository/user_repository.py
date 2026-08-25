from typing import Annotated, Any

from bson import ObjectId
from fastapi import Depends
from pymongo.asynchronous.collection import AsyncCollection

from src.models.user_model import User
from src.utils.db_client import get_db


def _doc_to_user(doc: dict) -> User:
    extras: dict = {}
    if doc.get("created_at"):
        extras["created_at"] = doc["created_at"]
    if doc.get("updated_at"):
        extras["updated_at"] = doc["updated_at"]
    return User(
        id=str(doc["_id"]),
        name=doc["name"],
        email=doc["email"],
        username=doc.get("username") or str(doc["email"]).split("@")[0],
        password=doc.get("password"),
        google_id=doc.get("google_id"),
        avatar_url=doc.get("avatar_url"),
        plan=doc.get("plan", "free"),
        is_active=doc.get("is_active", True),
        is_verified=doc.get("is_verified", False),
        **extras,
    )


class UserRepository:
    def __init__(self, collection: AsyncCollection):
        self.collection = collection

    async def create(self, user: User) -> User:
        data = user.model_dump(exclude={"id"})
        result = await self.collection.insert_one(data)
        user.id = str(result.inserted_id)
        return user

    async def find_by_email(self, email: str) -> User | None:
        doc = await self.collection.find_one({"email": email.lower()})
        return _doc_to_user(doc) if doc else None

    async def find_by_google_id(self, google_id: str) -> User | None:
        doc = await self.collection.find_one({"google_id": google_id})
        return _doc_to_user(doc) if doc else None

    async def find_by_id(self, user_id: str) -> User | None:
        if not ObjectId.is_valid(user_id):
            return None
        doc = await self.collection.find_one({"_id": ObjectId(user_id)})
        return _doc_to_user(doc) if doc else None

    async def save(self, user: User) -> User:
        if not user.id or not ObjectId.is_valid(user.id):
            return await self.create(user)
        data = user.model_dump(exclude={"id"})
        await self.collection.update_one({"_id": ObjectId(user.id)}, {"$set": data})
        return user


async def get_user_repo(db: Annotated[Any, Depends(get_db)]) -> UserRepository:
    return UserRepository(db["users"])


UserRepo = Annotated[UserRepository, Depends(get_user_repo)]
