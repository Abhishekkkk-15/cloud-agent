from pydantic import BaseModel,Field
import uuid
from datetime import datetime, UTC



class Workspace(BaseModel):
    name:str
    target_path:str
    source_path:str
    user_id:str
    sandbox_id:str
    is_active:bool = True
    created_at:datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at:datetime = Field(default_factory=lambda: datetime.now(UTC))