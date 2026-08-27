from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from pi_sdk import AgentEvent, EventType


@dataclass
class WsEvent:
    type: str
    text: str = ""
    session_id: str | None = None
    tool: str | None = None
    tool_call_id: str | None = None
    arguments: Any = None
    content: str | None = None
    target: str | None = None
    details: str | None = None
    denied: bool = False
    error: str | None = None
    message: str | None = None
    usage: dict[str, Any] | None = None
    done: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if v not in (None, "", False)}


def event_handler(event: AgentEvent) -> WsEvent:
    data = event.data or {}
    text = event.text

    if event.type == EventType.RUN_STARTED:
        return WsEvent(
            type="run_started",
            text=str(data.get("prompt") or ""),
            session_id=data.get("session_id"),
        )

    if event.type == EventType.USER_MESSAGE:
        return WsEvent(type="user_message", text=text)

    if event.type == EventType.THINKING_DELTA:
        return WsEvent(type="thinking_delta", text=text)

    if event.type == EventType.THINKING:
        return WsEvent(type="thinking", text=text)

    if event.type == EventType.TEXT_DELTA:
        return WsEvent(type="text_delta", text=text)

    if event.type == EventType.TEXT:
        return WsEvent(type="text", text=text)

    if event.type == EventType.TOOL_CALL:
        return WsEvent(
            type="tool_call",
            tool=data.get("name"),
            tool_call_id=data.get("id"),
            arguments=data.get("arguments"),
        )

    if event.type == EventType.TOOL_RESULT:
        return WsEvent(
            type="tool_result",
            tool=data.get("name"),
            tool_call_id=data.get("id"),
            content=data.get("content"),
            text=str(data.get("content") or ""),
        )

    if event.type == EventType.PERMISSION_REQUEST:
        return WsEvent(
            type="permission_request",
            tool=data.get("tool"),
            target=data.get("target"),
            details=data.get("details"),
            denied=bool(data.get("denied", False)),
            text=str(data.get("details") or ""),
        )

    if event.type == EventType.COMPACTION:
        return WsEvent(
            type="compaction",
            message=data.get("message"),
            text=str(data.get("message") or ""),
        )

    if event.type == EventType.USAGE:
        return WsEvent(
            type="usage",
            usage={
                "prompt_tokens": data.get("prompt_tokens"),
                "completion_tokens": data.get("completion_tokens"),
                "total_tokens": data.get("total_tokens"),
                "estimated_cost_usd": data.get("estimated_cost_usd"),
            },
        )

    if event.type == EventType.ERROR:
        return WsEvent(
            type="error",
            error=data.get("error"),
            message=data.get("title"),
            text=str(data.get("error") or ""),
        )

    if event.type == EventType.STATUS:
        return WsEvent(
            type="status",
            message=data.get("message"),
            text=str(data.get("message") or ""),
        )

    if event.type == EventType.RUN_COMPLETED:
        return WsEvent(
            type="run_completed",
            text=text or str(data.get("text") or ""),
            session_id=data.get("session_id"),
            done=True,
        )

    if event.type == EventType.RUN_FAILED:
        return WsEvent(
            type="run_failed",
            error=data.get("error"),
            session_id=data.get("session_id"),
            text=str(data.get("error") or ""),
            done=True,
        )

    return WsEvent(type=event.type.value, text=text)