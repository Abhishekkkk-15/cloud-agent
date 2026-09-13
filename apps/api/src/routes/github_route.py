from fastapi import APIRouter, Query

from src.controller.github_controller import (
    disconnect,
    get_authorize_url,
    get_status,
    list_repos,
    oauth_callback,
)
from src.deps import CurrentUser
from src.repository.user_repository import UserRepo
from src.schemas.github_schema import (
    GitHubAuthorizeResponse,
    GitHubReposResponse,
    GitHubStatusResponse,
)

router = APIRouter(prefix="/integrations/github", tags=["GitHub"])


@router.get("/authorize", response_model=GitHubAuthorizeResponse)
async def authorize(current_user: CurrentUser) -> GitHubAuthorizeResponse:
    return await get_authorize_url(current_user)


@router.get("/callback")
async def callback(
    repo: UserRepo,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    return await oauth_callback(code=code, state=state, repo=repo, error=error)


@router.get("/status", response_model=GitHubStatusResponse)
async def status(current_user: CurrentUser) -> GitHubStatusResponse:
    return await get_status(current_user)


@router.delete("", response_model=GitHubStatusResponse)
async def disconnect_github(
    current_user: CurrentUser, repo: UserRepo
) -> GitHubStatusResponse:
    return await disconnect(current_user, repo)


@router.get("/repos", response_model=GitHubReposResponse)
async def repos(
    current_user: CurrentUser,
    repo: UserRepo,
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
    q: str | None = Query(None),
) -> GitHubReposResponse:
    return await list_repos(
        current_user, repo, page=page, per_page=per_page, q=q
    )
