from fastapi import APIRouter, status
from src.controller.preview_controller import start_preview, preview


router = APIRouter(prefix="/workspaces", tags=["sessions"])
# @router.api_route(
#     "/preview/{workspace_id}/{path:path}",
#     methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
# )
router.get("/preview/{workspace_id}/{path:path}")(preview)
router.post("preview/{workspace_id}/")(start_preview)
