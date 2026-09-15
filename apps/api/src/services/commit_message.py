"""Build git commit subjects for workspace sync (3-level ladder)."""

from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path

from src.ai_core.intent_agent import IntentAgent
from src.services.workspace_git import WorkspaceGitService

logger = logging.getLogger(__name__)

_SUBJECT_MAX = 72
_FALLBACK = "cloud-agent sync"


def sanitize_commit_subject(raw: str, *, max_len: int = _SUBJECT_MAX) -> str:
    text = (raw or "").strip().strip("\"'`")
    text = re.sub(r"\s+", " ", text)
    # Subject only — drop accidental body after newline.
    text = text.split("\n", 1)[0].strip().rstrip(".")
    if not text:
        return ""
    if len(text) > max_len:
        text = text[: max_len - 1].rstrip() + "…"
    return text


def fallback_from_query(user_query: str) -> str:
    q = " ".join((user_query or "").split()).strip()
    if not q:
        return _FALLBACK
    return sanitize_commit_subject(f"cloud-agent: {q}") or _FALLBACK


def _collect_diff_stat(host_path: Path) -> str:
    if not host_path.exists():
        return ""
    git = WorkspaceGitService(host_path)
    try:
        return git.change_summary()
    except Exception:
        logger.warning("Failed to collect git change summary for %s", host_path)
        return ""


async def build_commit_message(
    *,
    host_path: Path,
    user_query: str = "",
    agent_summary: str = "",
    intent_agent: IntentAgent | None = None,
) -> str:
    """Level 1: LLM(query + summary + diff). Level 2: truncated query. Level 3: generic."""
    diff_stat = await asyncio.to_thread(_collect_diff_stat, host_path)

    if intent_agent is not None and (
        (user_query or "").strip()
        or (agent_summary or "").strip()
        or diff_stat
    ):
        try:
            subject = await intent_agent.suggest_commit_message(
                user_query=user_query,
                agent_summary=agent_summary[:1500],
                diff_stat=diff_stat,
            )
            cleaned = sanitize_commit_subject(subject)
            if cleaned:
                return cleaned
        except Exception:
            logger.warning("LLM commit message failed; using query fallback", exc_info=True)

    return fallback_from_query(user_query)
