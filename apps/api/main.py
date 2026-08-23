from fastapi import FastAPI
from src.ai_core.cloud_agent import CloudAgentCore
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from src.schemas.chat import ChatMessage
from src.schemas.sessions import ResumeSessionMessage
from src.ai_core.sandbox.sandbox import Sandbox


PiClient = CloudAgentCore()

app = FastAPI()
box:Sandbox = Sandbox()

origins = [
    "http://localhost:3000",    
    "http://localhost:5173",     
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
@app.post("/chat")
async def chat(body:ChatMessage):
    await PiClient.stream(body.msg)    
    return {"started":"true"}
@app.post("/resume")
async def resume(body:ResumeSessionMessage):
    res = await PiClient.resume(body.session_id)    
    print(res)
    # return res


@app.get("/box")
def run_sandbox():
    print("Starting sandbox")
    res =  (box.run_sandbox())
    # str_to_bytes
    print(res)
    return {"success":"true"}

@app.get("/list")
def list():
    return box.docker_ls()    
    
if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000,reload=True)
