"""Resolve CloudAgentCore model/effort kwargs and compare fingerprints."""

from __future__ import annotations

import os

from src.models.ai_model import AIModel
from src.repository.model_repository import ModelRepository
from src.utils.config import config

AgentFingerprint = tuple[str | None, str | None, str | None, str | None, str | None]


def resolve_model_api_key(target: AIModel) -> str | None:
    if target.api_key:
        return target.api_key
    if target.api_key_env:
        return os.getenv(target.api_key_env) or None
    return None


def normalize_agent_kwargs(kwargs: dict) -> dict:
    """Apply config defaults the same way CloudAgentCore.__init__ does."""
    return {
        "model": kwargs.get("model") or config.model,
        "provider": kwargs.get("provider") or config.provider,
        "base_url": kwargs.get("base_url") or config.base_url,
        "api_key": kwargs.get("api_key") or config.api_key,
        "reasoning_effort": kwargs.get("reasoning_effort") or "high",
    }


def agent_fingerprint(kwargs: dict) -> AgentFingerprint:
    n = normalize_agent_kwargs(kwargs)
    return (
        n["provider"],
        n["model"],
        n["base_url"],
        n["api_key"],
        n["reasoning_effort"],
    )


async def build_agent_kwargs_from_request(
    model_repo: ModelRepository,
    *,
    model_key: str | None,
    effort: str | None,
) -> dict:
    """Resolve CloudAgentCore kwargs from message payload; empty → config defaults."""
    kwargs: dict = {}
    if not model_key:
        if effort:
            kwargs["reasoning_effort"] = effort
        return kwargs

    if model_key == "auto":
        target_model = await model_repo.find_default()
    else:
        target_model = await model_repo.find_by_id(model_key)

    if not target_model:
        if effort:
            kwargs["reasoning_effort"] = effort
        return kwargs

    kwargs["model"] = target_model.model_id
    kwargs["provider"] = target_model.provider
    if target_model.url or target_model.base_url:
        kwargs["base_url"] = target_model.url or target_model.base_url
    api_key = resolve_model_api_key(target_model)
    if api_key:
        kwargs["api_key"] = api_key

    if effort:
        kwargs["reasoning_effort"] = effort
    elif target_model.supports_effort and target_model.default_effort:
        kwargs["reasoning_effort"] = target_model.default_effort

    return kwargs
