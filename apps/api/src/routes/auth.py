from fastapi import APIRouter

from src.controller.auth_controller import google_login, refresh_tokens, to_public_user
from src.deps import CurrentUser
from src.repository.user import UserRepo
from src.schemas.auth import (
    GoogleAuthRequest,
    PublicUser,
    RefreshTokenRequest,
    TokenPairResponse,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/google", response_model=TokenPairResponse)
async def google_auth(body: GoogleAuthRequest, repo: UserRepo) -> TokenPairResponse:
    return await google_login(body, repo)


@router.post("/refresh", response_model=TokenPairResponse)
async def refresh(body: RefreshTokenRequest, repo: UserRepo) -> TokenPairResponse:
    return await refresh_tokens(body, repo)


@router.get("/me", response_model=PublicUser)
async def me(user: CurrentUser) -> PublicUser:
    return to_public_user(user)
