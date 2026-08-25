from pydantic import BaseModel

class SandboxRunResult(BaseModel):
    id:str
    name:str
    status:str
    