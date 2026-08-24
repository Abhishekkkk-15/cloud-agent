from fastapi import APIRouter,status

from src.schemas.user import RegisterUserRequset,RegisterUserReponse

from src.controller.user_controller import register_user

router = APIRouter(prefix="/users",tags=["Users"])

router.post("/register",response_model=RegisterUserReponse,status_code=status.HTTP_201_CREATED)(register_user)