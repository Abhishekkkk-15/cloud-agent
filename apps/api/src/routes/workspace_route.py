from fastapi import APIRouter
from src.controller.chat_controller import start_chat
from src.controller.workspace_controller import create_workspace
from src.schemas.workspace_schema import CreateWorkspaceRequest
from fastapi import status
# router = APIRouter(prefix="/chats", tags=["chat"])
router = APIRouter(prefix="/workspaces", tags=["chat"])

# router.post("/new",status_code=status.HTTP_200_OK)(start_chat)
router.post("/new",status_code=status.HTTP_201_CREATED)(create_workspace)
