from pydantic import BaseModel


class ResumeSessionMessage(BaseModel):
    session_id:str