from fastapi import APIRouter

from src.controller.sessions_controller import (
    create_session,
    get_session,
    update_session,
)
from src.deps import CurrentUser
from src.models.pi_sdk_models import MongoSessionDocument
from src.repository.session_repository import SessionRepo

router = APIRouter(prefix="/sessions", tags=["sessions"])

router.get("/{session_id}")(get_session)
router.post("/")(create_session)
router.put("/{session_id}")(update_session)
