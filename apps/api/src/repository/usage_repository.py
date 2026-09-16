from datetime import datetime, timezone
import calendar
from typing import Annotated, Any
from fastapi import Depends
from pymongo.asynchronous.collection import AsyncCollection

from src.utils.db_client import get_db


def current_period_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


def days_left_in_month() -> int:
    now = datetime.now(timezone.utc)
    _, total_days = calendar.monthrange(now.year, now.month)
    return max(0, total_days - now.day)


class UsageRepository:
    def __init__(self, db: Any):
        self.db = db
        self.user_usage_coll: AsyncCollection = db["monthly_user_usage"]
        self.model_usage_coll: AsyncCollection = db["monthly_model_usage"]

    async def record_usage(
        self,
        user_id: str,
        model_id: str | None,
        provider: str | None,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        cached_tokens: int = 0,
        cost_usd: float = 0.0,
    ) -> None:
        period = current_period_str()
        now = datetime.now(timezone.utc)
        total_tokens = prompt_tokens + completion_tokens

        # 1. Update user monthly usage
        user_doc_id = f"{user_id}_{period}"
        await self.user_usage_coll.update_one(
            {"_id": user_doc_id},
            {
                "$inc": {
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": total_tokens,
                    "cached_tokens": cached_tokens,
                    "estimated_cost_usd": round(cost_usd, 6),
                },
                "$set": {"last_updated": now},
                "$setOnInsert": {"user_id": user_id, "period": period},
            },
            upsert=True,
        )

        # 2. Update model monthly usage
        clean_model = model_id or "default"
        clean_provider = provider or "unknown"
        model_doc_id = f"{clean_model}_{period}"
        await self.model_usage_coll.update_one(
            {"_id": model_doc_id},
            {
                "$inc": {
                    "total_tokens": total_tokens,
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "estimated_cost_usd": round(cost_usd, 6),
                    "turn_count": 1,
                },
                "$set": {
                    "provider": clean_provider,
                    "model_id": clean_model,
                    "last_updated": now,
                },
                "$setOnInsert": {"period": period},
            },
            upsert=True,
        )

    async def get_user_month_spend(self, user_id: str, period: str | None = None) -> float:
        clean_period = period or current_period_str()
        doc_id = f"{user_id}_{clean_period}"
        doc = await self.user_usage_coll.find_one({"_id": doc_id})
        if not doc:
            return 0.0
        return float(doc.get("estimated_cost_usd", 0.0))

    async def get_user_month_usage(self, user_id: str, period: str | None = None) -> dict[str, Any]:
        clean_period = period or current_period_str()
        doc_id = f"{user_id}_{clean_period}"
        doc = await self.user_usage_coll.find_one({"_id": doc_id})
        if not doc:
            return {
                "user_id": user_id,
                "period": clean_period,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0,
                "cached_tokens": 0,
                "estimated_cost_usd": 0.0,
            }
        return {
            "user_id": user_id,
            "period": clean_period,
            "prompt_tokens": int(doc.get("prompt_tokens", 0)),
            "completion_tokens": int(doc.get("completion_tokens", 0)),
            "total_tokens": int(doc.get("total_tokens", 0)),
            "cached_tokens": int(doc.get("cached_tokens", 0)),
            "estimated_cost_usd": float(doc.get("estimated_cost_usd", 0.0)),
        }

    async def get_top_spenders(self, period: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        clean_period = period or current_period_str()
        cursor = self.user_usage_coll.find({"period": clean_period}).sort("estimated_cost_usd", -1).limit(limit)
        results = []
        async for doc in cursor:
            results.append({
                "user_id": doc.get("user_id"),
                "total_tokens": int(doc.get("total_tokens", 0)),
                "prompt_tokens": int(doc.get("prompt_tokens", 0)),
                "completion_tokens": int(doc.get("completion_tokens", 0)),
                "estimated_cost_usd": float(doc.get("estimated_cost_usd", 0.0)),
            })
        return results

    async def get_model_spend(self, period: str | None = None) -> list[dict[str, Any]]:
        clean_period = period or current_period_str()
        cursor = self.model_usage_coll.find({"period": clean_period}).sort("estimated_cost_usd", -1)
        results = []
        async for doc in cursor:
            results.append({
                "model_id": doc.get("model_id", "unknown"),
                "provider": doc.get("provider", "unknown"),
                "cost_usd": round(float(doc.get("estimated_cost_usd", 0.0)), 4),
                "total_tokens": int(doc.get("total_tokens", 0)),
                "turn_count": int(doc.get("turn_count", 0)),
            })
        return results

    async def get_platform_total_usage(self, period: str | None = None) -> dict[str, Any]:
        clean_period = period or current_period_str()
        pipeline = [
            {"$match": {"period": clean_period}},
            {
                "$group": {
                    "_id": None,
                    "total_spend_usd": {"$sum": "$estimated_cost_usd"},
                    "total_tokens": {"$sum": "$total_tokens"},
                    "total_prompt_tokens": {"$sum": "$prompt_tokens"},
                    "total_completion_tokens": {"$sum": "$completion_tokens"},
                    "active_users_count": {"$sum": 1},
                }
            },
        ]
        cursor = await self.user_usage_coll.aggregate(pipeline)
        results = await cursor.to_list(length=1)
        if results:
            r = results[0]
            total_spend = round(float(r.get("total_spend_usd", 0.0)), 4)
            # Estimate projected spend based on current day of month
            now = datetime.now(timezone.utc)
            _, total_days = calendar.monthrange(now.year, now.month)
            day_of_month = max(1, now.day)
            daily_rate = total_spend / day_of_month
            projected = round(daily_rate * total_days, 4)

            return {
                "total_spend_usd": total_spend,
                "projected_spend_usd": projected,
                "total_tokens": int(r.get("total_tokens", 0)),
                "total_prompt_tokens": int(r.get("total_prompt_tokens", 0)),
                "total_completion_tokens": int(r.get("total_completion_tokens", 0)),
                "active_users_count": int(r.get("active_users_count", 0)),
            }

        return {
            "total_spend_usd": 0.0,
            "projected_spend_usd": 0.0,
            "total_tokens": 0,
            "total_prompt_tokens": 0,
            "total_completion_tokens": 0,
            "active_users_count": 0,
        }


async def get_usage_repo(db: Annotated[Any, Depends(get_db)]) -> UsageRepository:
    return UsageRepository(db)


UsageRepo = Annotated[UsageRepository, Depends(get_usage_repo)]
