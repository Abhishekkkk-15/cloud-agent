from typing import Annotated, Any
from fastapi import Depends
from pymongo.asynchronous.collection import AsyncCollection

from src.utils.config import config
from src.utils.db_client import get_db

SETTINGS_DOC_ID = "agent_config"


class SettingsRepository:
    def __init__(self, collection: AsyncCollection):
        self.collection = collection

    async def get_agent_config(self) -> dict[str, Any]:
        doc = await self.collection.find_one({"_id": SETTINGS_DOC_ID})
        if not doc:
            doc = {}
        return {
            "default_model_id": doc.get("default_model_id") or config.model,
            "default_effort": doc.get("default_effort") or "high",
            "autonomous_mode": doc.get("autonomous_mode", config.autonomous),
            "max_retries": int(doc.get("max_retries", 3)),
            "compaction_enabled": doc.get("compaction_enabled", config.compaction_enabled),
            "compact_at_tokens": int(doc.get("compact_at_tokens", config.compact_at_tokens)),
            "keep_recent_tokens": int(doc.get("keep_recent_tokens", config.keep_recent_tokens)),
            "system_prompt_prefix": doc.get("system_prompt_prefix"),
        }

    async def update_agent_config(self, updates: dict[str, Any]) -> dict[str, Any]:
        clean_updates = {k: v for k, v in updates.items() if v is not None}
        if clean_updates:
            await self.collection.update_one(
                {"_id": SETTINGS_DOC_ID},
                {"$set": clean_updates},
                upsert=True,
            )
        return await self.get_agent_config()


async def get_settings_repo(db: Annotated[Any, Depends(get_db)]) -> SettingsRepository:
    return SettingsRepository(db["settings"])


SettingsRepo = Annotated[SettingsRepository, Depends(get_settings_repo)]
