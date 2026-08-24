from pydantic import BaseModel,Field
import uuid
from datetime import datetime, UTC



class Workspace(BaseModel):
    id:str
    title:str
    user_id:str
    target_path:str     # internal container path
    source_path:str     # host mount path    
    sandbox_id:str              # Cotainer id
    is_active:bool = True
    created_at:datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at:datetime = Field(default_factory=lambda: datetime.now(UTC))