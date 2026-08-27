from fastapi import HTTPException, status

from src.deps import CurrentUser
from src.models.pi_sdk_models import MongoSessionDocument
from src.repository.message_repository import MessageRepo
from src.repository.session_repository import SessionRepo


async def get_session(
    current_user: CurrentUser,
    session_repo: SessionRepo,
    session_id: str,
    message_repo: MessageRepo,
):
    print("session_id",session_id)
    session = await session_repo.find_by_id(session_id)
    print(session)
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
    return {
        "session": session.model_dump(by_alias=True),
        "messages": [message.model_dump() for message in messages],
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

    session_obj = MongoSessionDocument(
        id="000000000000000000000000",
        title="New session",
        workspace="/app",
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
