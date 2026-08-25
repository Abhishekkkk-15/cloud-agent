from fastapi import APIRouter,status

from src.schemas.user_schema import RegisterUserRequset,RegisterUserReponse
from src.models.user_model import User
from src.controller.user_controller import register_user,read_user_me

router = APIRouter(prefix="/users",tags=["Users"])

router.post("/register",response_model=RegisterUserReponse,status_code=status.HTTP_201_CREATED)(register_user)
router.get("/me",status_code=status.HTTP_200_OK)(read_user_me)
