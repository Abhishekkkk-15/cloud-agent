from fastapi import APIRouter, status
from src.controller.preview_controller import start_preview


router = APIRouter(prefix="/workspaces", tags=["sessions"])

router.post("/{workspace_id}/preview")(start_preview)
