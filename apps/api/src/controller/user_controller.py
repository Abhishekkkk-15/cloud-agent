from src.models.users import User
from src.repository.user import UserRepo
from src.schemas.user import RegisterUserRequset
from fastapi import Depends
from src.dependency.auth_dependency import get_current_user
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

    
async def read_user_me(current_user: Annotated[User, Depends(get_current_user)]):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "plan": current_user.plan
    }
    