from pydantic import BaseModel

class ChatMessage(BaseModel):
    msg:str