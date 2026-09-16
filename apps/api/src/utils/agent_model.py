"""Resolve CloudAgentCore model/effort kwargs and compare fingerprints."""

from __future__ import annotations

import os

from src.models.ai_model import AIModel
from src.repository.model_repository import ModelRepository
from src.repository.settings_repository import SettingsRepository
from src.utils.config import config

AgentFingerprint = tuple[
    str | None,
    str | None,
    str | None,
    str | None,
    str | None,
    bool | None,
    bool | None,
    int | None,
    int | None,
    int | None,
    str | None,
]


def resolve_model_api_key(target: AIModel) -> str | None:
    if target.api_key:
        return target.api_key
    if target.api_key_env:
        resolved = os.getenv(target.api_key_env)
        if resolved:
            return resolved
    return config.api_key or None


def normalize_agent_kwargs(kwargs: dict) -> dict:
    """Apply config defaults the same way CloudAgentCore.__init__ does."""
    return {
        "model": kwargs.get("model") or config.model,
        "provider": kwargs.get("provider") or config.provider,
        "base_url": kwargs.get("base_url") or config.base_url,
        "api_key": kwargs.get("api_key") or config.api_key,
        "reasoning_effort": kwargs.get("reasoning_effort") or "high",
        "autonomous": kwargs.get("autonomous") if kwargs.get("autonomous") is not None else config.autonomous,
        "compaction_enabled": kwargs.get("compaction_enabled") if kwargs.get("compaction_enabled") is not None else config.compaction_enabled,
        "compact_at_tokens": kwargs.get("compact_at_tokens") or config.compact_at_tokens,
        "keep_recent_tokens": kwargs.get("keep_recent_tokens") or config.keep_recent_tokens,
        "max_retries": kwargs.get("max_retries") if kwargs.get("max_retries") is not None else 3,
        "system_prompt_prefix": kwargs.get("system_prompt_prefix"),
    }


def agent_fingerprint(kwargs: dict) -> AgentFingerprint:
    n = normalize_agent_kwargs(kwargs)
    return (
        n["provider"],
        n["model"],
        n["base_url"],
        n["api_key"],
        n["reasoning_effort"],
        n["autonomous"],
        n["compaction_enabled"],
        n["compact_at_tokens"],
        n["keep_recent_tokens"],
        n["max_retries"],
        n["system_prompt_prefix"],
    )


async def build_agent_kwargs_from_request(
    model_repo: ModelRepository,
    *,
    model_key: str | None = None,
    effort: str | None = None,
    settings_repo: SettingsRepository | None = None,
) -> dict:
    """Resolve CloudAgentCore kwargs from message payload and admin settings; empty → config defaults."""
    kwargs: dict = {}
    config_settings: dict = {}
    if settings_repo:
        try:
            config_settings = await settings_repo.get_agent_config()
        except Exception:
            config_settings = {}

    if config_settings:
        if "autonomous_mode" in config_settings:
            kwargs["autonomous"] = config_settings["autonomous_mode"]
        if "max_retries" in config_settings:
            kwargs["max_retries"] = config_settings["max_retries"]
        if "compaction_enabled" in config_settings:
            kwargs["compaction_enabled"] = config_settings["compaction_enabled"]
        if "compact_at_tokens" in config_settings:
            kwargs["compact_at_tokens"] = config_settings["compact_at_tokens"]
        if "keep_recent_tokens" in config_settings:
            kwargs["keep_recent_tokens"] = config_settings["keep_recent_tokens"]
        if config_settings.get("system_prompt_prefix"):
            kwargs["system_prompt_prefix"] = config_settings["system_prompt_prefix"]

    target_effort = effort or config_settings.get("default_effort")

    resolved_model_key = model_key
    if not resolved_model_key or resolved_model_key == "auto":
        default_from_settings = config_settings.get("default_model_id")
        if default_from_settings:
            resolved_model_key = default_from_settings
        elif resolved_model_key == "auto":
            resolved_model_key = "auto"
        else:
            if target_effort:
                kwargs["reasoning_effort"] = target_effort
            return kwargs

    if resolved_model_key == "auto":
        target_model = await model_repo.find_default()
    else:
        target_model = await model_repo.find_by_id(resolved_model_key)
        if not target_model and (model_key == "auto" or not model_key):
            target_model = await model_repo.find_default()

    if not target_model:
        if target_effort:
            kwargs["reasoning_effort"] = target_effort
        return kwargs

    kwargs["model"] = target_model.model_id
    kwargs["provider"] = target_model.provider
    if target_model.url or target_model.base_url:
        kwargs["base_url"] = target_model.url or target_model.base_url
    api_key = resolve_model_api_key(target_model)
    if api_key:
        kwargs["api_key"] = api_key

    if target_effort:
        kwargs["reasoning_effort"] = target_effort
    elif target_model.supports_effort and target_model.default_effort:
        kwargs["reasoning_effort"] = target_model.default_effort

    return kwargs
