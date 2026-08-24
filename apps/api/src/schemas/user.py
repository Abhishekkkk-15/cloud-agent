from pydantic import BaseModel

class RegisterUserRequset(BaseModel):
    name:str
    email:str
    password:str

class RegisterUserReponse(BaseModel):
    id:str
    name:str
    email:str