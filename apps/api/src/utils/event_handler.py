from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from pi_sdk import AgentEvent, EventType

# Keys commonly used by file / shell tools for a UI label (never send full payloads).
_PATH_KEYS = ("path", "file", "file_path", "target", "filename", "filepath")
_CMD_KEYS = ("command", "cmd")
_TARGET_MAX = 160
_SUMMARY_MAX = 200


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
    ok: bool | None = None
    done: bool = False

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for key, value in asdict(self).items():
            if value is None or value == "":
                continue
            if value is False:
                # ok=False must be sent; other flags default to false when absent
                if key == "ok":
                    out[key] = False
                continue
            out[key] = value
        return out


def _truncate(value: str, max_len: int = _TARGET_MAX) -> str:
    text = value.strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 1] + "…"


def _as_nonempty_str(value: Any) -> str | None:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return None


def _tool_target(data: dict[str, Any]) -> str | None:
    """Extract a short path/command label; never return file bodies."""
    direct = (
        _as_nonempty_str(data.get("target"))
        or _as_nonempty_str(data.get("path"))
        or _as_nonempty_str(data.get("file"))
    )
    if direct:
        return _truncate(direct)

    arguments = data.get("arguments")
    if isinstance(arguments, dict):
        for key in _PATH_KEYS:
            path = _as_nonempty_str(arguments.get(key))
            if path:
                return _truncate(path)
        for key in _CMD_KEYS:
            cmd = _as_nonempty_str(arguments.get(key))
            if cmd:
                return _truncate(cmd, _TARGET_MAX)

    return None


def _tool_result_ok(data: dict[str, Any]) -> bool:
    if data.get("is_error") is True or data.get("ok") is False:
        return False
    content = data.get("content")
    if isinstance(content, str):
        lowered = content[:80].lower()
        if lowered.startswith("error") or "permission denied" in lowered:
            return False
    return True


def _tool_result_summary(data: dict[str, Any], *, ok: bool) -> str | None:
    """Optional short status line — never the full tool output."""
    err = _as_nonempty_str(data.get("error"))
    if err:
        return _truncate(err, _SUMMARY_MAX)
    if not ok:
        content = data.get("content")
        if isinstance(content, str) and content.strip():
            # First line only, truncated — enough for UI, not a file dump.
            first_line = content.strip().splitlines()[0]
            return _truncate(first_line, _SUMMARY_MAX)
    return None


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
        return WsEvent(type="agent:user_message", text=text)

    if event.type == EventType.THINKING_DELTA:
        return WsEvent(type="agent:thinking_delta", text=text)

    if event.type == EventType.THINKING:
        return WsEvent(type="agent:thinking", text=text)

    if event.type == EventType.TEXT_DELTA:
        return WsEvent(type="agent:text_delta", text=text)

    if event.type == EventType.TEXT:
        return WsEvent(type="agent:text", text=text)

    if event.type == EventType.TOOL_CALL:
        # Activity UI only needs tool name + path/command — not full arguments.
        return WsEvent(
            type="agent:tool_call",
            tool=data.get("name"),
            tool_call_id=data.get("id"),
            target=_tool_target(data),
        )

    if event.type == EventType.TOOL_RESULT:
        ok = _tool_result_ok(data)
        summary = _tool_result_summary(data, ok=ok)
        return WsEvent(
            type="agent:tool_result",
            tool=data.get("name"),
            tool_call_id=data.get("id"),
            target=_tool_target(data),
            ok=ok,
            message=summary,
            # Do not send content / text blobs (file bodies, grep dumps, etc.)
        )

    if event.type == EventType.PERMISSION_REQUEST:
        details = _as_nonempty_str(data.get("details"))
        return WsEvent(
            type="agent:permission_request",
            tool=data.get("tool"),
            target=data.get("target"),
            details=_truncate(details, _SUMMARY_MAX) if details else None,
            denied=bool(data.get("denied", False)),
            text=_truncate(details, _SUMMARY_MAX) if details else "",
        )

    if event.type == EventType.COMPACTION:
        return WsEvent(
            type="agent:compaction",
            message=data.get("message"),
            text=str(data.get("message") or ""),
        )

    if event.type == EventType.USAGE:
        return WsEvent(
            type="agent:usage",
            usage={
                "prompt_tokens": data.get("prompt_tokens"),
                "completion_tokens": data.get("completion_tokens"),
                "total_tokens": data.get("total_tokens"),
                "estimated_cost_usd": data.get("estimated_cost_usd"),
            },
        )

    if event.type == EventType.ERROR:
        return WsEvent(
            type="agent:error",
            error=data.get("error"),
            message=data.get("title"),
            text=str(data.get("error") or ""),
        )

    if event.type == EventType.STATUS:
        return WsEvent(
            type="agent:status",
            message=data.get("message"),
            text=str(data.get("message") or ""),
        )

    if event.type == EventType.RUN_COMPLETED:
        return WsEvent(
            type="agent:run_completed",
            text=text or str(data.get("text") or ""),
            session_id=data.get("session_id"),
            done=True,
        )

    if event.type == EventType.RUN_FAILED:
        return WsEvent(
            type="agent:run_failed",
            error=data.get("error"),
            session_id=data.get("session_id"),
            text=str(data.get("error") or ""),
            done=True,
        )

    return WsEvent(type=f"agent:{event.type.value}", text=text)
