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

    async def sync_from_sessions(self, period: str | None = None) -> None:
        clean_period = period or current_period_str()
        sessions_coll = self.db["sessions"]
        query = {
            "created_at": {"$regex": f"^{clean_period}"},
            "user_id": {"$exists": True, "$ne": None},
        }
        cursor = sessions_coll.find(query)
        user_agg: dict[str, dict[str, Any]] = {}
        async for s in cursor:
            uid = s.get("user_id")
            if not uid:
                continue
            p_tok = int(s.get("prompt_tokens") or 0)
            c_tok = int(s.get("completion_tokens") or 0)
            t_tok = int(s.get("total_tokens") or (p_tok + c_tok))
            cached_tok = int(s.get("cached_tokens") or 0)
            cost = float(s.get("estimated_cost_usd") or 0.0)

            if cost <= 0.0 and (p_tok > 0 or c_tok > 0):
                cost = (p_tok * 2.0 / 1_000_000.0) + (c_tok * 8.0 / 1_000_000.0)

            if uid not in user_agg:
                user_agg[uid] = {
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "total_tokens": 0,
                    "cached_tokens": 0,
                    "estimated_cost_usd": 0.0,
                }
            user_agg[uid]["prompt_tokens"] += p_tok
            user_agg[uid]["completion_tokens"] += c_tok
            user_agg[uid]["total_tokens"] += t_tok
            user_agg[uid]["cached_tokens"] += cached_tok
            user_agg[uid]["estimated_cost_usd"] += cost

        now = datetime.now(timezone.utc)
        for uid, data in user_agg.items():
            user_doc_id = f"{uid}_{clean_period}"
            existing = await self.user_usage_coll.find_one({"_id": user_doc_id})
            if not existing or existing.get("total_tokens", 0) < data["total_tokens"]:
                await self.user_usage_coll.update_one(
                    {"_id": user_doc_id},
                    {
                        "$set": {
                            "user_id": uid,
                            "period": clean_period,
                            "prompt_tokens": max(data["prompt_tokens"], existing.get("prompt_tokens", 0) if existing else 0),
                            "completion_tokens": max(data["completion_tokens"], existing.get("completion_tokens", 0) if existing else 0),
                            "total_tokens": max(data["total_tokens"], existing.get("total_tokens", 0) if existing else 0),
                            "cached_tokens": max(data["cached_tokens"], existing.get("cached_tokens", 0) if existing else 0),
                            "estimated_cost_usd": round(max(data["estimated_cost_usd"], existing.get("estimated_cost_usd", 0.0) if existing else 0.0), 6),
                            "last_updated": now,
                        }
                    },
                    upsert=True,
                )

        model_count = await self.model_usage_coll.count_documents({"period": clean_period})
        if model_count == 0 and user_agg:
            tot_p = sum(d["prompt_tokens"] for d in user_agg.values())
            tot_c = sum(d["completion_tokens"] for d in user_agg.values())
            tot_cost = sum(d["estimated_cost_usd"] for d in user_agg.values())
            tot_t = sum(d["total_tokens"] for d in user_agg.values())
            await self.model_usage_coll.update_one(
                {"_id": f"gpt-5.6-luna_{clean_period}"},
                {
                    "$set": {
                        "model_id": "gpt-5.6-luna",
                        "provider": "openai",
                        "period": clean_period,
                        "prompt_tokens": tot_p,
                        "completion_tokens": tot_c,
                        "total_tokens": tot_t,
                        "estimated_cost_usd": round(tot_cost, 6),
                        "turn_count": len(user_agg),
                        "last_updated": now,
                    }
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
