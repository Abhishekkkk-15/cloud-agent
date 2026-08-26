from src.utils.ws_manager import ws_manager, ConnectionManager
from fastapi import APIRouter, WebSocket
router = APIRouter()




async def websocket_endpoint(ws:WebSocket):
    await ws_manager.connect(ws)
    print("websocket connection setablished")
    while True:
        text = await ws.receive()    
        print(text)
        await ws_manager.send_jsno(data={"worker":"thread"},websocket=ws)
        
    # ws_manager.disconnect(ws)    
    
router.websocket("/ws")(websocket_endpoint)

