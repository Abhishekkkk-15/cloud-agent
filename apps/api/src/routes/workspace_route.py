from fastapi import APIRouter
from src.controller.chat_controller import start_chat
from fastapi import status
router = APIRouter(prefix="/chats", tags=["chat"])

router.post("/new",status_code=status.HTTP_200_OK)(start_chat)