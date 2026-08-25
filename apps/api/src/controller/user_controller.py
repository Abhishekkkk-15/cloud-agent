from src.models.user_model import User
from src.repository.user_repository import UserRepo
from src.schemas.user_schema import RegisterUserRequset
from fastapi import Depends
from src.dependency.auth_dependency import CurrentUser
from typing import Annotated, Any


async def register_user(body: RegisterUserRequset, repo: UserRepo):
    username = body.email.split("@")[0]
    user_data = User(
        name=body.name,
        email=body.email.lower(),
        username=username,
        password=body.password,
    )
    return await repo.create(user_data)

    
async def read_user_me(current_user: CurrentUser):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "plan": current_user.plan
    }
    