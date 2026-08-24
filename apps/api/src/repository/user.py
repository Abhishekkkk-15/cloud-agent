from pymongo.asynchronous.collection import AsyncCollection
from src.models.users import User
from typing import Annotated,Any
from fastapi import Depends
from src.utils.db_client import get_db


class UserRepository:
    def __init__(self,collection:AsyncCollection):
        self.collection = collection
    
    async def create(self,user:User):
        data = user.model_dump(exclude={"id"})
        result = await self.collection.insert_one(data)
        user.id = str(result.inserted_id)
        return user

async def get_user_repo(db: Annotated[Any, Depends(get_db)]) -> UserRepository:
    users_collection = db["users"] 
    return UserRepository(users_collection)

UserRepo = Annotated[UserRepository,Depends(get_user_repo)]
