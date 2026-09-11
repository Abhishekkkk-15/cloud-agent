from fastapi import WebSocket
from src.models.user_model import User
from src.utils.jwt_utils import decode_access_token
from src.repository.user_repository import UserRepo
from pydantic import BaseModel
from typing import Any


from starlette.websockets import WebSocketState


class WSMessage(BaseModel):
    type: str
    data: Any

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    async def receive(self, websocket: WebSocket) -> WSMessage:
        data = await websocket.receive_json()
        print(data)
        return WSMessage(
            type=data["type"],
            data=data.get("data"),
        )

    async def send_json(self, data: Any, websocket: WebSocket):
        try:
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_json(data=data)
        except Exception:
            pass

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)


async def authenticate_websocket(
    websocket: WebSocket,
    user_repo: UserRepo
) -> User:
    token = websocket.cookies.get("ca_access_token") or websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        raise RuntimeError("Missing authentication token in websocket cookie or query params")

    try:
        payload = decode_access_token(token)
    except Exception as e:
        print(f"[WebSocket Auth] Token decode error: {e}")
        await websocket.close(code=1008)
        raise RuntimeError("Invalid token") from e

    user = await user_repo.find_by_id(payload)

    if not user:
        print("[WebSocket Auth] User not found")
        await websocket.close(code=1008)
        raise RuntimeError("User not found")

    return user

ws_manager = ConnectionManager()