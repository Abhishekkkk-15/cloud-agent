import asyncio

from fastapi import FastAPI
from src.ai_core.cloud_agent import CloudAgentCore
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from src.schemas.chat import ChatMessage
from src.schemas.sessions import ResumeSessionMessage
from src.ai_core.sandbox.sandbox import Sandbox
from src.utils.db_client import db_lifespan

# routes

from src.routes.user import router as UserRouter
from src.routes.auth import router as AuthRouter

_pi_client: CloudAgentCore | None = None
_box: Sandbox | None = None


def get_pi_client() -> CloudAgentCore:
    global _pi_client
    if _pi_client is None:
        _pi_client = CloudAgentCore()
    return _pi_client


def get_sandbox() -> Sandbox:
    global _box
    if _box is None:
        _box = Sandbox()
    return _box


app = FastAPI(lifespan=db_lifespan)

origins = [
    "http://localhost:3000",    
    "http://localhost:5173",
    "http://127.0.0.1:5173", 
    "http://localhost:8001",     
    "https://yourfrontend.com",  
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,            
    allow_credentials=True,           
    allow_methods=["*"],              
    allow_headers=["*"],              
)



@app.get("/")
def health():
    
    return {"health":True}
async def _fire_and_forget_stream(msg: str):
    try:
        await get_pi_client().stream(msg)
    except Exception as e:
        # Keep the request/response cycle responsive even if the agent fails.
        print(f"PiClient.stream failed: {e}")


app.include_router(UserRouter)
app.include_router(AuthRouter)

@app.post("/chat")
async def chat(body:ChatMessage):
    asyncio.create_task(_fire_and_forget_stream(body.msg))
    return {"started": True}


    

@app.post("/resume")
async def resume(body:ResumeSessionMessage):
    res = await get_pi_client().resume(body.session_id)    
    print(res)
    return {"res": str(res)}


@app.get("/box")
async def run_sandbox():
    print("Starting sandbox")
    res = await asyncio.to_thread(get_sandbox().run_sandbox)
    print(res)
    return {"success": "true", "result": res}

@app.get("/list")
async def list():
    return await asyncio.to_thread(get_sandbox().docker_ls)    
 
print("STARTED LISTNINIG")
    
if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000,reload=True)
