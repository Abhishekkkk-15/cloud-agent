from fastapi import Depends
from src.schemas.user import RegisterUserRequset
from src.repository.user import UserRepo
from src.models.users import User


async def register_user(body: RegisterUserRequset, repo: UserRepo):
    user_data = User(**body.model_dump())
    user = await repo.create(user_data)
    return user
    