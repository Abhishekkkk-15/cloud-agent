from pydantic import BaseModel,Field
import uuid
from datetime import datetime, UTC
from enum import Enum
class WorkspaceStatus(str, Enum):
    PENDING = "pending"    # Created in DB, waiting for WS connection & agent execution
    RUNNING = "running"    # Sandbox initialized, agent currently executing
    READY = "ready"        # Agent finished initial generation
    FAILED = "failed"

class Workspace(BaseModel):
    id:str|None = None
    title:str
    user_id:str
    target_path:str     # internal container path
    source_path:str     # host mount path    
    sandbox_id:str|None    = None      # Cotainer id
    is_active:bool = True
    
    
    
    initial_prompt:str =""
    status: WorkspaceStatus = WorkspaceStatus.PENDING
    
    created_at:datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at:datetime = Field(default_factory=lambda: datetime.now(UTC))

    # Host ports published on the sandbox (container: frontend=4000, backend=4001)
    frontend_port: int | None = None
    backend_port: int | None = None
    preview_port: int | None = None  # alias: frontend host port for Preview UI
    preview_url: str | None = None
    preview_status: str | None = None
    backend_url: str | None = None