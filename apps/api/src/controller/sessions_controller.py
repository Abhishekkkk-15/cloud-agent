from fastapi import HTTPException, status

from pi_sdk.compaction import Compaction
from pi_sdk.models import Message as SdkMessage, Role as SdkRole, Session as SdkSession
from src.deps import CurrentUser
from src.models.pi_sdk_models import MongoSessionDocument
from src.repository.message_repository import MessageRepo
from src.repository.model_repository import ModelRepo
from src.repository.session_repository import SessionRepo, generate_session_id
from src.repository.settings_repository import SettingsRepo
from src.utils.config import config


async def get_session(
    current_user: CurrentUser,
    session_repo: SessionRepo,
    session_id: str,
    message_repo: MessageRepo,
    model_repo: ModelRepo,
    settings_repo: SettingsRepo,
    model: str | None = None,
):
    session = await session_repo.find_by_id(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    is_admin = getattr(current_user, "role", "") == "admin"
    if session.user_id != current_user.id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden",
        )

    messages = await message_repo.find_by_session(session_id)

    # Resolve actual model context window from our models collection in database
    target_model_id = model or config.model
    db_model = await model_repo.find_by_model_id(target_model_id)
    if not db_model:
        db_model = await model_repo.get_default_model()
    model_window = (db_model.context_window if (db_model and db_model.context_window) else None) or 128000

    # Resolve compaction threshold limit from admin settings / config
    agent_cfg = await settings_repo.get_agent_config()
    compact_limit = int(agent_cfg.get("compact_at_tokens") or config.compact_at_tokens or 80000)
    target_limit = compact_limit if agent_cfg.get("compaction_enabled", True) else model_window

    filled = 0
    if messages:
        try:
            sdk_session = SdkSession(
                id=session.id,
                title=session.title,
                workspace=session.workspace,
                prompt_tokens=session.prompt_tokens,
                completion_tokens=session.completion_tokens,
                total_tokens=session.total_tokens,
                cached_tokens=session.cached_tokens,
                compaction_summary=session.compaction_summary or "",
                compacted_until=session.compacted_until,
            )
            sdk_msgs = [
                SdkMessage(
                    role=SdkRole(getattr(m.role, "value", str(m.role)).lower()),
                    content=m.content or "",
                    name=m.name,
                    tool_calls=m.tool_calls,
                    tool_call_id=m.tool_call_id,
                )
                for m in messages
            ]
            comp = Compaction()
            filled = comp.working_token_count(sdk_msgs, sdk_session)
        except Exception:
            active_msgs = messages[session.compacted_until:] if session.compacted_until < len(messages) else messages
            active_words = sum(len((m.content or "").split()) for m in active_msgs)
            filled = min(target_limit, max(0, 350 + int(active_words * 1.3)))

    remaining_tokens = max(0, target_limit - filled)
    percent_used = round((filled / target_limit) * 100, 2) if target_limit > 0 else 0.0

    context_usage = {
        "filled_tokens": filled,
        "total_tokens": target_limit,
        "remaining_tokens": remaining_tokens,
        "percent_used": percent_used,
        "compact_at_tokens": compact_limit,
        "model_limit": model_window,
    }

    return {
        "session": session.model_dump(by_alias=True),
        "messages": [message.model_dump() for message in messages],
        "context_usage": context_usage,
    }


async def create_session(
    current_user: CurrentUser,
    session_repo: SessionRepo,
    workspace_id: str,
):
    if not current_user.id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )

    # Host cwd for this workspace (pi_sdk resume/new_session use session.workspace).
    session_obj = MongoSessionDocument(
        id=generate_session_id(),
        title="New session",
        workspace=str(config.workspace_base / workspace_id),
        workspace_id=workspace_id,
        user_id=current_user.id,
    )
    session = await session_repo.create(session_obj)

    if session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden",
        )

    return session.model_dump(by_alias=True)


async def update_session(
    current_user: CurrentUser,
    session_repo: SessionRepo,
    session_id: str,
    session: MongoSessionDocument,
):
    existing = await session_repo.find_by_id(session_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    if existing.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden",
        )

    session.id = session_id
    updated = await session_repo.save(session)
    return updated.model_dump(by_alias=True)


async def delete_session(
    current_user: CurrentUser,
    session_repo: SessionRepo,
    message_repo: MessageRepo,
    session_id: str,
):
    existing = await session_repo.find_by_id(session_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    if existing.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden",
        )

    await message_repo.delete_by_session(session_id)
    deleted = await session_repo.delete(session_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )


async def get_session_analytics(
    current_user: CurrentUser,
    session_repo: SessionRepo,
    session_id: str,
    message_repo: MessageRepo,
    model_repo: ModelRepo,
    settings_repo: SettingsRepo,
    model: str | None = None,
):
    session = await session_repo.find_by_id(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    is_admin = getattr(current_user, "role", "") == "admin"
    if session.user_id != current_user.id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden",
        )

    messages = await message_repo.find_by_session(session_id)

    # 1. System Prompt analysis
    sys_msg = next((m for m in messages if getattr(m.role, "value", str(m.role)).lower() == "system"), None)
    sys_content = (sys_msg.content or "") if sys_msg else ""
    estimated_sys_tokens = int(len(sys_content) / 3.8) if sys_content else 0

    # 2. Tool calls and results analysis
    tool_calls_map: dict[str, dict] = {}
    tool_breakdown: dict[str, dict] = {}
    tool_executions: list[dict] = []
    total_calls = 0
    total_success = 0
    total_failure = 0

    # First pass: collect assistant tool calls
    for m in messages:
        tool_calls = getattr(m, "tool_calls", None) or []
        for tc in tool_calls:
            t_id = tc.get("id") or tc.get("tool_call_id")
            fn = tc.get("function") or {}
            t_name = fn.get("name") or tc.get("name") or "tool"
            t_args = fn.get("arguments") or tc.get("arguments") or ""
            if t_id:
                tool_calls_map[t_id] = {
                    "tool_name": t_name,
                    "arguments": t_args,
                    "call_seq": m.seq,
                }

    # Second pass: collect tool results and evaluate success/failure
    for m in messages:
        role_str = getattr(m.role, "value", str(m.role)).lower()
        if role_str == "tool":
            t_id = getattr(m, "tool_call_id", None)
            t_name = getattr(m, "name", None)
            call_info = tool_calls_map.get(t_id) if t_id else None
            if not t_name and call_info:
                t_name = call_info["tool_name"]
            t_name = t_name or "tool"

            content = m.content or ""
            char_count = len(content)
            estimated_tokens = int(char_count / 3.8)

            # Failure detection heuristics
            lower_head = content[:300].lower()
            is_failure = (
                "error" in lower_head
                or "failed" in lower_head
                or "fatal:" in lower_head
                or "permission denied" in lower_head
                or "not found" in lower_head
                or ("exit code:" in lower_head and "exit code: 0" not in lower_head)
                or "exception" in lower_head
                or "syntaxerror" in lower_head
                or "typeerror" in lower_head
                or "traceback" in lower_head
            )

            reason = None
            if is_failure:
                lines = [line.strip() for line in content.splitlines() if line.strip()]
                for line in lines:
                    low_l = line.lower()
                    if any(k in low_l for k in ("error", "failed", "fatal", "permission denied", "not found", "cannot", "exception")):
                        reason = line[:200]
                        break
                if not reason and lines:
                    reason = lines[0][:200]

            total_calls += 1
            if is_failure:
                total_failure += 1
            else:
                total_success += 1

            if t_name not in tool_breakdown:
                tool_breakdown[t_name] = {
                    "name": t_name,
                    "call_count": 0,
                    "success_count": 0,
                    "failure_count": 0,
                    "total_output_chars": 0,
                    "estimated_output_tokens": 0,
                }
            tool_breakdown[t_name]["call_count"] += 1
            if is_failure:
                tool_breakdown[t_name]["failure_count"] += 1
            else:
                tool_breakdown[t_name]["success_count"] += 1
            tool_breakdown[t_name]["total_output_chars"] += char_count
            tool_breakdown[t_name]["estimated_output_tokens"] += estimated_tokens

            tool_executions.append({
                "seq": m.seq,
                "tool_call_id": t_id,
                "tool_name": t_name,
                "arguments": call_info["arguments"] if call_info else None,
                "status": "error" if is_failure else "success",
                "error_reason": reason,
                "output_preview": content[:240] + ("..." if len(content) > 240 else ""),
                "full_output": content,
                "char_count": char_count,
                "estimated_tokens": estimated_tokens,
            })

    progression = []
    accumulated_chars = len(sys_content)
    for m in messages:
        r_str = getattr(m.role, "value", str(m.role)).lower()
        if r_str == "system":
            continue
        c_len = len(m.content or "")
        accumulated_chars += c_len
        progression.append({
            "seq": m.seq,
            "role": r_str,
            "name": getattr(m, "name", None),
            "chars": c_len,
            "estimated_tokens": int(c_len / 3.8),
            "working_context_tokens": int(accumulated_chars / 3.8),
        })

    return {
        "session": {
            "id": session.id,
            "title": session.title,
            "workspace_id": session.workspace_id,
            "prompt_tokens": session.prompt_tokens,
            "completion_tokens": session.completion_tokens,
            "total_tokens": session.total_tokens,
            "cached_tokens": session.cached_tokens,
            "estimated_cost_usd": session.estimated_cost_usd,
            "compacted_until": session.compacted_until,
            "has_compaction": bool(session.compaction_summary),
            "compaction_summary_length": len(session.compaction_summary or ""),
            "total_messages": len(messages),
        },
        "system_prompt": {
            "char_count": len(sys_content),
            "estimated_tokens": estimated_sys_tokens,
            "content": sys_content,
        },
        "tools_summary": {
            "total_calls": total_calls,
            "total_success": total_success,
            "total_failure": total_failure,
            "failure_rate_percent": round((total_failure / total_calls * 100), 1) if total_calls > 0 else 0.0,
        },
        "tools_breakdown": sorted(tool_breakdown.values(), key=lambda x: -x["call_count"]),
        "tool_executions": tool_executions,
        "timeline_progression": progression,
    }
