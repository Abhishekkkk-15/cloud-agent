
from fastapi import FastAPI
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from src.utils.db_client import db_lifespan

# routes

from src.routes.user_route import router as UserRouter
from src.routes.auth_route import router as AuthRouter
from src.routes.workspace_route import router as ChatRouter

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

app.include_router(UserRouter)
app.include_router(AuthRouter)
app.include_router(ChatRouter)
  
 
print("STARTED LISTNINIG")
    
if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000)
