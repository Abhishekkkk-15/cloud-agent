from typing import Annotated
from fastapi import Cookie, Depends, HTTPException, status,Header
import jwt
from dotenv import load_dotenv
from jwt.exceptions import InvalidTokenError
from src.repository.user import UserRepo,UserRepository
from src.models.users import User
from src.repository.user import get_user_repo
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

import os
load_dotenv()
security = HTTPBearer()
SECRET_KEY = os.getenv("JWT_SECRET") or "dev-insecure-change-me"
ALGORITHM = "HS256"
async def get_current_user(
     *,
    ca_refresh_token: Annotated[str | None, Cookie()] = None,
    ca_access_token: Annotated[str | None, Cookie()] = None,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    repo:  Annotated[UserRepository, Depends(get_user_repo)],
) -> User:
    print(ca_access_token,credentials)
    
    token = ca_access_token or credentials.credentials 
    
    print(token)   
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Missing  token cookie.",
        )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload.",
            )
        user_id: str = str(payload.get("sub")) 
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