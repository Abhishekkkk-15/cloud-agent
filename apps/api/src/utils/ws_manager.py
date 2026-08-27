from fastapi import WebSocket
from src.models.user_model import User
from src.utils.jwt_utils import decode_access_token
from src.repository.user_repository import UserRepo
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    async def send_json(self,data:dict[str,str],websocket:WebSocket):
        await websocket.send_json(data=data)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)


async def authenticate_websocket(
    websocket: WebSocket,
    user_repo:UserRepo
) -> User:
    token = websocket.cookies.get("ca_access_token")
    if not token:
        await websocket.close(code=1008)
        raise RuntimeError()

    payload = decode_access_token(token)

    user = await user_repo.find_by_id(payload)

    if not user:
        print("from user    ")
        await websocket.close(code=1008)
        raise RuntimeError()

    return user

ws_manager = ConnectionManager()