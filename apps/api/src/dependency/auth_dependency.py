from typing import Annotated
from fastapi import Cookie, Depends, HTTPException, status
import jwt
from dotenv import load_dotenv
from jwt.exceptions import InvalidTokenError
from src.repository.user import UserRepo
from src.models.users import User
import os
load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET") or "dev-insecure-change-me"
ALGORITHM = "HS256"
async def get_current_user(
    refresh_token: Annotated[str | None, Cookie()] = None,
    repo: UserRepo = Depends() 
) -> User:
    
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Missing refresh token cookie.",
        )
        
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload.",
            )
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or expired.",
        )
        
    user = await repo.find_by_id(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )
        
    return user