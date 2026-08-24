from src.models.users import User
from src.repository.user import UserRepo
from src.schemas.user import RegisterUserRequset


async def register_user(body: RegisterUserRequset, repo: UserRepo):
    username = body.email.split("@")[0]
    user_data = User(
        name=body.name,
        email=body.email.lower(),
        username=username,
        password=body.password,
    )
    return await repo.create(user_data)

    
    