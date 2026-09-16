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
    if doc.get("github_connected_at"):
        extras["github_connected_at"] = doc["github_connected_at"]

    role = doc.get("role") or "user"

    return User(
        id=str(doc["_id"]),
        name=doc["name"],
        email=doc["email"],
        username=doc.get("username") or str(doc["email"]).split("@")[0],
        password=doc.get("password"),
        google_id=doc.get("google_id"),
        avatar_url=doc.get("avatar_url"),
        plan=doc.get("plan", "free"),
        role=role,
        is_active=doc.get("is_active", True),
        is_verified=doc.get("is_verified", False),
        github_id=doc.get("github_id"),
        github_login=doc.get("github_login"),
        github_avatar_url=doc.get("github_avatar_url"),
        github_access_token_enc=doc.get("github_access_token_enc"),
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

    async def find_all(
        self,
        search: str | None = None,
        role: str | None = None,
        plan: str | None = None,
        limit: int = 100,
        skip: int = 0,
    ) -> list[User]:
        filter_query: dict[str, Any] = {}
        if search:
            regex = {"$regex": search, "$options": "i"}
            filter_query["$or"] = [
                {"name": regex},
                {"email": regex},
                {"username": regex},
            ]
        if role:
            filter_query["role"] = role
        if plan:
            filter_query["plan"] = plan

        cursor = self.collection.find(filter_query).sort("created_at", -1).skip(skip).limit(limit)
        docs = await cursor.to_list(length=None)
        return [_doc_to_user(doc) for doc in docs]

    async def count_total(self, filter_query: dict[str, Any] | None = None) -> int:
        return await self.collection.count_documents(filter_query or {})

    async def update_role(self, user_id: str, role: str) -> bool:
        if not ObjectId.is_valid(user_id):
            return False
        result = await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"role": role}},
        )
        return result.matched_count > 0

    async def update_plan(self, user_id: str, plan: str) -> bool:
        if not ObjectId.is_valid(user_id):
            return False
        result = await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"plan": plan}},
        )
        return result.matched_count > 0

    async def update_status(self, user_id: str, is_active: bool) -> bool:
        if not ObjectId.is_valid(user_id):
            return False
        result = await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"is_active": is_active}},
        )
        return result.matched_count > 0

    async def delete(self, user_id: str) -> bool:
        if not ObjectId.is_valid(user_id):
            return False
        result = await self.collection.delete_one({"_id": ObjectId(user_id)})
        return result.deleted_count > 0

    async def save(self, user: User) -> User:
        if not user.id or not ObjectId.is_valid(user.id):
            return await self.create(user)
        data = user.model_dump(exclude={"id"})
        await self.collection.update_one({"_id": ObjectId(user.id)}, {"$set": data})
        return user


async def get_user_repo(db: Annotated[Any, Depends(get_db)]) -> UserRepository:
    return UserRepository(db["users"])


UserRepo = Annotated[UserRepository, Depends(get_user_repo)]
