
from fastapi import FastAPI
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from src.utils.db_client import db_lifespan

# routes

from src.routes.user_route import router as UserRouter
from src.routes.auth_route import router as AuthRouter
from src.routes.workspace_route import router as ChatRouter
from src.routes.session_route import router as SessionRouter
from src.ws.chat_ws import router as WSRouter
from src.routes.session_route import router as SessionRouter
from src.routes.preview_route import router as PreviewRouter

from src.middleware.subdomain_proxy_middleware import SubdomainProxyMiddleware

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
    allow_origin_regex=r"^https?://([a-zA-Z0-9_-]+\.)*lvh\.me(:\d+)?$",
    allow_credentials=True,           
    allow_methods=["*"],                
    allow_headers=["*"],              
)

# Intercept wildcard subdomains (e.g. <workspace_id>.lvh.me:8000) for preview proxying
app.add_middleware(SubdomainProxyMiddleware)

@app.get("/")
def health():
    return {"health":True}

app.include_router(UserRouter)
app.include_router(AuthRouter)
app.include_router(ChatRouter)
app.include_router(SessionRouter)
app.include_router(WSRouter)  
app.include_router(PreviewRouter)  
 
print("STARTED LISTNINIG")
    
if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000)
