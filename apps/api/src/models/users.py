from pydantic import BaseModel,Field, EmailStr
from datetime import datetime, UTC
class User(BaseModel):
    id: str|None = None
    name:str = Field(min_length=4,max_length=100)
    email:EmailStr
    
    password:str
    is_active:bool = True
    is_verified:bool = False
    
    created_at:datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at:datetime = Field(default_factory=lambda: datetime.now(UTC))
    