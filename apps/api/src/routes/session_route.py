from fastapi import APIRouter, status

from src.controller.sessions_controller import (
    create_session,
    delete_session,
    get_session,
    update_session,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])

router.get("/{session_id}")(get_session)
router.post("/")(create_session)
router.put("/{session_id}")(update_session)
router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)(delete_session)
