from fastapi import HTTPException, status

from pi_sdk.compaction import Compaction
from pi_sdk.models import Message as SdkMessage, Role as SdkRole, Session as SdkSession
from src.deps import CurrentUser
from src.models.pi_sdk_models import MongoSessionDocument
from src.repository.message_repository import MessageRepo
from src.repository.model_repository import ModelRepo
from src.repository.session_repository import SessionRepo, generate_session_id
from src.utils.config import config


async def get_session(
    current_user: CurrentUser,
    session_repo: SessionRepo,
    session_id: str,
    message_repo: MessageRepo,
    model_repo: ModelRepo,
    model: str | None = None,
):
    session = await session_repo.find_by_id(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    if session.user_id != current_user.id:
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
            filled = min(model_window, max(0, 350 + int(active_words * 1.3)))

    context_usage = {
        "filled_tokens": filled,
        "total_tokens": model_window,
        "remaining_tokens": max(0, model_window - filled),
        "percent_used": round((filled / model_window) * 100, 2),
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
