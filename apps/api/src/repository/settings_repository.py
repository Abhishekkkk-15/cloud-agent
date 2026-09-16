from typing import Annotated, Any
from fastapi import Depends
from pymongo.asynchronous.collection import AsyncCollection

from src.utils.config import config
from src.utils.db_client import get_db

SETTINGS_DOC_ID = "agent_config"
SANDBOX_SETTINGS_DOC_ID = "sandbox_config"


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

    async def get_sandbox_config(self) -> dict[str, Any]:
        doc = await self.collection.find_one({"_id": SANDBOX_SETTINGS_DOC_ID})
        if not doc:
            doc = {}
        return {
            "memory_limit_mb": int(doc.get("memory_limit_mb", config.sandbox_memory_limit_mb)),
            "cpu_limit": float(doc.get("cpu_limit", config.sandbox_cpu_limit)),
            "pids_limit": int(doc.get("pids_limit", config.sandbox_pids_limit)),
            "memory_swap_limit_mb": int(doc.get("memory_swap_limit_mb", -1)),
        }

    async def update_sandbox_config(self, updates: dict[str, Any]) -> dict[str, Any]:
        clean_updates = {k: v for k, v in updates.items() if v is not None and k != "apply_to_running"}
        if clean_updates:
            await self.collection.update_one(
                {"_id": SANDBOX_SETTINGS_DOC_ID},
                {"$set": clean_updates},
                upsert=True,
            )
        return await self.get_sandbox_config()

    async def get_plan_budgets(self) -> dict[str, Any]:
        doc = await self.collection.find_one({"_id": "plan_budgets"})
        if not doc:
            doc = {}
        return {
            "free": float(doc.get("free", 5.0)),
            "hacker": float(doc.get("hacker", 20.0)),
            "pro": float(doc.get("pro", 50.0)),
            "soft_cap_percent": int(doc.get("soft_cap_percent", 80)),
            "enabled": bool(doc.get("enabled", True)),
        }

    async def update_plan_budgets(self, updates: dict[str, Any]) -> dict[str, Any]:
        clean_updates = {k: v for k, v in updates.items() if v is not None}
        if clean_updates:
            await self.collection.update_one(
                {"_id": "plan_budgets"},
                {"$set": clean_updates},
                upsert=True,
            )
        return await self.get_plan_budgets()


async def get_settings_repo(db: Annotated[Any, Depends(get_db)]) -> SettingsRepository:
    return SettingsRepository(db["settings"])


SettingsRepo = Annotated[SettingsRepository, Depends(get_settings_repo)]
