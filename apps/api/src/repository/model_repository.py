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
        "name": "GPT-4o",
        "model_id": "gpt-4o",
        "provider": "openai",
        "url": "https://api.openai.com/v1",
        "base_url": "https://api.openai.com/v1",
        "api_key_env": "OPENAI_API_KEY",
        "is_active": True,
        "is_default": True,
        "supports_effort": False,
        "default_effort": None,
        "use_case": ["coding", "fullstack", "architecture", "general"],
        "badge": "Omni",
        "description": "High-speed multimodal flagship model for general fullstack tasks",
        "context_window": 128000,
        "max_tokens": 16384,
        "input_price_per_mtok": 2.50,
        "output_price_per_mtok": 10.00,
    },
    {
        "name": "o3-mini",
        "model_id": "o3-mini",
        "provider": "openai",
        "url": "https://api.openai.com/v1",
        "base_url": "https://api.openai.com/v1",
        "api_key_env": "OPENAI_API_KEY",
        "is_active": True,
        "is_default": False,
        "supports_effort": True,
        "default_effort": "medium",
        "use_case": ["math", "reasoning", "complex-logic", "algorithm"],
        "badge": "Math & Code",
        "description": "Specialized STEM and coding reasoning model with flexible effort",
        "context_window": 200000,
        "max_tokens": 100000,
        "input_price_per_mtok": 1.10,
        "output_price_per_mtok": 4.40,
    },
    {
        "name": "Claude 3.7 Sonnet",
        "model_id": "claude-3-7-sonnet-20250219",
        "provider": "anthropic",
        "url": "https://api.anthropic.com/v1",
        "base_url": "https://api.anthropic.com/v1",
        "api_key_env": "ANTHROPIC_API_KEY",
        "is_active": True,
        "is_default": False,
        "supports_effort": True,
        "default_effort": "medium",
        "use_case": ["coding", "architecture", "deep-reasoning", "refactoring"],
        "badge": "Reasoning",
        "description": "Hybrid reasoning model with deep coding and architectural skills",
        "context_window": 200000,
        "max_tokens": 64000,
        "input_price_per_mtok": 3.00,
        "output_price_per_mtok": 15.00,
    },
    {
        "name": "Claude 3.5 Sonnet",
        "model_id": "claude-3-5-sonnet-20241022",
        "provider": "anthropic",
        "url": "https://api.anthropic.com/v1",
        "base_url": "https://api.anthropic.com/v1",
        "api_key_env": "ANTHROPIC_API_KEY",
        "is_active": True,
        "is_default": False,
        "supports_effort": False,
        "default_effort": None,
        "use_case": ["coding", "fast-agent", "frontend", "general"],
        "badge": "Fast",
        "description": "Fast, precise, intelligent coding assistant",
        "context_window": 200000,
        "max_tokens": 8192,
        "input_price_per_mtok": 3.00,
        "output_price_per_mtok": 15.00,
    },
    {
        "name": "Mistral Large",
        "model_id": "mistral-large-latest",
        "provider": "mistral",
        "url": "https://api.mistral.ai/v1",
        "base_url": "https://api.mistral.ai/v1",
        "api_key_env": "MISTRAL_API_KEY",
        "is_active": True,
        "is_default": False,
        "supports_effort": False,
        "default_effort": None,
        "use_case": ["coding", "multilingual", "general", "fullstack"],
        "badge": "Flagship",
        "description": "Top-tier reasoning and code generation from Mistral AI",
        "context_window": 128000,
        "max_tokens": 8192,
        "input_price_per_mtok": 2.00,
        "output_price_per_mtok": 6.00,
    },
    {
        "name": "Llama 3.3 70B",
        "model_id": "llama-3.3-70b-versatile",
        "provider": "groq",
        "url": "https://api.groq.com/openai/v1",
        "base_url": "https://api.groq.com/openai/v1",
        "api_key_env": "GROQ_API_KEY",
        "is_active": True,
        "is_default": False,
        "supports_effort": False,
        "default_effort": None,
        "use_case": ["speed", "quick-edits", "chat", "general"],
        "badge": "Ultra Fast",
        "description": "Blazing fast inference on Groq with high-quality open weights",
        "context_window": 128000,
        "max_tokens": 32768,
        "input_price_per_mtok": 0.59,
        "output_price_per_mtok": 0.79,
    },
    {
        "name": "Gemini 2.5 Flash",
        "model_id": "gemini-2.5-flash",
        "provider": "vertex",
        "url": "us-central1",
        "base_url": "us-central1",
        "api_key_env": "VERTEX_API_KEY",
        "is_active": True,
        "is_default": False,
        "supports_effort": False,
        "default_effort": None,
        "use_case": ["speed", "multimodal", "coding", "general"],
        "badge": "Fast",
        "description": "High-speed multimodal agent model with wide context",
        "context_window": 1000000,
        "max_tokens": 8192,
        "input_price_per_mtok": 0.15,
        "output_price_per_mtok": 0.60,
    },
    {
        "name": "DeepSeek R1",
        "model_id": "deepseek-reasoner",
        "provider": "deepseek",
        "url": "https://api.deepseek.com/v1",
        "base_url": "https://api.deepseek.com/v1",
        "api_key_env": "DEEPSEEK_API_KEY",
        "is_active": True,
        "is_default": False,
        "supports_effort": True,
        "default_effort": "high",
        "use_case": ["math", "reasoning", "deep-thinking", "algorithm"],
        "badge": "Open Reasoning",
        "description": "Open-weights reasoning model with explicit chain-of-thought",
        "context_window": 64000,
        "max_tokens": 8192,
        "input_price_per_mtok": 0.55,
        "output_price_per_mtok": 2.19,
    },
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
        return seeded


async def get_model_repo(db: Annotated[Any, Depends(get_db)]) -> ModelRepository:
    return ModelRepository(db["models"])


ModelRepo = Annotated[ModelRepository, Depends(get_model_repo)]
