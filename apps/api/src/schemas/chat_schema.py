from pydantic import BaseModel

class ChatMessageRequest(BaseModel):
    query:str
    