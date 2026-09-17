from datetime import datetime, timezone
from typing import Annotated, Any

from bson import ObjectId
from fastapi import Depends
from pymongo.asynchronous.collection import AsyncCollection

from src.models.ai_model import AIModel
from src.utils.db_client import get_db


def _doc_to_model(doc: dict) -> AIModel:
    extras: dict = {}
    if doc.get("created_at"):
        extras["created_at"] = doc["created_at"]
    if doc.get("updated_at"):
        extras["updated_at"] = doc["updated_at"]

    effective_url = doc.get("url") or doc.get("base_url")

    return AIModel(
        id=str(doc["_id"]),
        name=doc.get("name", ""),
        model_id=doc.get("model_id") or doc.get("model") or str(doc["_id"]),
        provider=doc.get("provider", "openai"),
        url=effective_url,
        base_url=doc.get("base_url") or effective_url,
        api_key=doc.get("api_key"),
        api_key_env=doc.get("api_key_env"),
        is_active=doc.get("is_active", True),
        is_default=doc.get("is_default", False),
        supports_effort=doc.get("supports_effort", False),
        is_multi_model=doc.get("is_multi_model", False),
        default_effort=doc.get("default_effort"),
        use_case=doc.get("use_case") or [],
        badge=doc.get("badge"),
        description=doc.get("description", ""),
        context_window=doc.get("context_window"),
        max_tokens=doc.get("max_tokens"),
        input_price_per_mtok=float(doc.get("input_price_per_mtok", 0.0) or 0.0),
        output_price_per_mtok=float(doc.get("output_price_per_mtok", 0.0) or 0.0),
        **extras,
    )


DEFAULT_MODELS_SEED = [
    {
        "name": "GPT-5.6 Luna",
        "model_id": "gpt-5.6-luna",
        "provider": "openai",
        "url": "https://api.openai.com/v1",
        "base_url": "https://api.openai.com/v1",
        "api_key_env": "OPENAI_API_KEY",
        "is_active": True,
        "is_default": True,
        "supports_effort": True,
        "is_multi_model": True,
        "default_effort": "high",
        "use_case": ["coding", "fullstack", "architecture", "deep-reasoning"],
        "badge": "Default",
        "description": "Next-gen flagship reasoning and agentic execution",
        "context_window": 400000,
        "max_tokens": 128000,
        "input_price_per_mtok": 0.0,
        "output_price_per_mtok": 0.0,
    },
    {
        "name": "GPT-5.4 Mini",
        "model_id": "gpt-5.4-mini",
        "provider": "openai",
        "url": "https://api.openai.com/v1",
        "base_url": "https://api.openai.com/v1",
        "api_key_env": "OPENAI_API_KEY",
        "is_active": True,
        "is_default": False,
        "supports_effort": True,
        "is_multi_model": True,
        "default_effort": "medium",
        "use_case": ["coding", "fast-agent", "fullstack", "general"],
        "badge": "Fast",
        "description": "Faster GPT-5.4 variant for everyday coding and agent tasks",
        "context_window": 400000,
        "max_tokens": 128000,
        "input_price_per_mtok": 0.0,
        "output_price_per_mtok": 0.0,
    }
]


class ModelRepository:
    def __init__(self, collection: AsyncCollection):
        self.collection = collection

    async def create(self, model: AIModel) -> AIModel:
        if model.is_default:
            await self.collection.update_many({}, {"$set": {"is_default": False}})

        data = model.model_dump(exclude={"id"})
        result = await self.collection.insert_one(data)
        model.id = str(result.inserted_id)
        return model

    async def find_all(
        self, active_only: bool = False, provider: str | None = None
    ) -> list[AIModel]:
        query: dict[str, Any] = {}
        if active_only:
            query["is_active"] = True
        if provider:
            query["provider"] = provider.lower()

        cursor = self.collection.find(query).sort("created_at", 1)
        docs = await cursor.to_list(length=None)

        if not docs and active_only:
            # Auto-seed if database collection is empty
            await self.seed_default_models()
            cursor = self.collection.find(query).sort("created_at", 1)
            docs = await cursor.to_list(length=None)

        return [_doc_to_model(doc) for doc in docs]

    async def find_by_id(self, model_id_or_id: str) -> AIModel | None:
        # 1. Try by ObjectId if valid
        if ObjectId.is_valid(model_id_or_id):
            doc = await self.collection.find_one({"_id": ObjectId(model_id_or_id)})
            if doc:
                return _doc_to_model(doc)

        # 2. Try by string _id
        doc = await self.collection.find_one({"_id": model_id_or_id})
        if doc:
            return _doc_to_model(doc)

        # 3. Try by model_id (e.g. "gpt-4o", "o3-mini")
        doc = await self.collection.find_one({"model_id": model_id_or_id})
        if doc:
            return _doc_to_model(doc)

        # 4. Try case-insensitive matching on name or model_id
        doc = await self.collection.find_one(
            {
                "$or": [
                    {"name": {"$regex": f"^{model_id_or_id}$", "$options": "i"}},
                    {"model_id": {"$regex": f"^{model_id_or_id}$", "$options": "i"}},
                ]
            }
        )
        return _doc_to_model(doc) if doc else None

    async def find_by_use_case(self, use_case: str) -> list[AIModel]:
        cursor = self.collection.find(
            {"use_case": {"$regex": f"^{use_case}$", "$options": "i"}, "is_active": True}
        )
        docs = await cursor.to_list(length=None)
        return [_doc_to_model(doc) for doc in docs]

    async def find_default(self) -> AIModel | None:
        doc = await self.collection.find_one({"is_default": True, "is_active": True})
        if not doc:
            doc = await self.collection.find_one({"is_active": True})
        return _doc_to_model(doc) if doc else None

    # Convenience aliases
    find_by_model_id = find_by_id
    get_default_model = find_default

    async def update(self, model_id_or_id: str, data: dict) -> AIModel | None:
        existing = await self.find_by_id(model_id_or_id)
        if not existing or not existing.id:
            return None

        if data.get("is_default") is True:
            await self.collection.update_many({}, {"$set": {"is_default": False}})

        data["updated_at"] = datetime.now(timezone.utc)
        filter_query = (
            {"_id": ObjectId(existing.id)}
            if ObjectId.is_valid(existing.id)
            else {"_id": existing.id}
        )
        await self.collection.update_one(filter_query, {"$set": data})
        return await self.find_by_id(existing.id)

    async def delete(self, model_id_or_id: str) -> bool:
        existing = await self.find_by_id(model_id_or_id)
        if not existing or not existing.id:
            return False

        filter_query = (
            {"_id": ObjectId(existing.id)}
            if ObjectId.is_valid(existing.id)
            else {"_id": existing.id}
        )
        result = await self.collection.delete_one(filter_query)
        return result.deleted_count > 0

    async def seed_default_models(self) -> list[AIModel]:
        seeded: list[AIModel] = []
        now = datetime.now(timezone.utc)
        for item in DEFAULT_MODELS_SEED:
            existing = await self.collection.find_one({"model_id": item["model_id"]})
            if not existing:
                to_insert = {**item, "created_at": now, "updated_at": now}
                res = await self.collection.insert_one(to_insert)
                item_copy = {**to_insert, "_id": res.inserted_id}
                seeded.append(_doc_to_model(item_copy))
            else:
                seeded.append(_doc_to_model(existing))

        # Keep a single default aligned with the seed (gpt-5.6-luna).
        default_item = next(
            (i for i in DEFAULT_MODELS_SEED if i.get("is_default")), None
        )
        if default_item:
            await self.collection.update_many({}, {"$set": {"is_default": False}})
            await self.collection.update_one(
                {"model_id": default_item["model_id"]},
                {"$set": {"is_default": True, "updated_at": now}},
            )
            # Refresh seeded list defaults for response accuracy
            seeded = []
            for item in DEFAULT_MODELS_SEED:
                doc = await self.collection.find_one({"model_id": item["model_id"]})
                if doc:
                    seeded.append(_doc_to_model(doc))

        return seeded


async def get_model_repo(db: Annotated[Any, Depends(get_db)]) -> ModelRepository:
    return ModelRepository(db["models"])


ModelRepo = Annotated[ModelRepository, Depends(get_model_repo)]
