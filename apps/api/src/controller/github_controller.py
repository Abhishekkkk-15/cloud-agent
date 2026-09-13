from __future__ import annotations

from datetime import UTC, datetime
from urllib.parse import quote

import httpx
from fastapi import HTTPException, status
from fastapi.responses import RedirectResponse

from src.deps import CurrentUser
from src.repository.user_repository import UserRepo
from src.schemas.github_schema import (
    GitHubAuthorizeResponse,
    GitHubRepoItem,
    GitHubReposResponse,
    GitHubStatusResponse,
)
from src.utils.config import config
from src.utils.github_oauth import (
    build_authorize_url,
    create_oauth_state,
    exchange_code_for_token,
    fetch_github_repos,
    fetch_github_user,
    verify_oauth_state,
)
from src.utils.token_crypto import decrypt_token, encrypt_token


def _settings_redirect(result: str) -> RedirectResponse:
    return RedirectResponse(
        url=f"{config.web_app_url}/settings?github={quote(result)}",
        status_code=status.HTTP_302_FOUND,
    )


def _require_connected_token(user: CurrentUser) -> str:
    if not user.github_access_token_enc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "github_not_connected",
                "message": "Connect GitHub before continuing",
            },
        )
    try:
        return decrypt_token(user.github_access_token_enc)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "github_token_invalid",
                "message": "GitHub token could not be decrypted; reconnect GitHub",
            },
        ) from exc


async def get_authorize_url(current_user: CurrentUser) -> GitHubAuthorizeResponse:
    if not current_user.id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        state = create_oauth_state(current_user.id)
        url = build_authorize_url(state)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    return GitHubAuthorizeResponse(url=url)


async def oauth_callback(
    code: str | None,
    state: str | None,
    repo: UserRepo,
    error: str | None = None,
) -> RedirectResponse:
    if error:
        return _settings_redirect("error")
    if not code or not state:
        return _settings_redirect("error")

    try:
        user_id = verify_oauth_state(state)
        access_token = await exchange_code_for_token(code)
        gh_user = await fetch_github_user(access_token)
    except Exception:
        return _settings_redirect("error")

    user = await repo.find_by_id(user_id)
    if user is None or not user.id:
        return _settings_redirect("error")

    now = datetime.now(UTC)
    user.github_id = str(gh_user.get("id") or "") or None
    user.github_login = str(gh_user.get("login") or "") or None
    avatar = gh_user.get("avatar_url")
    user.github_avatar_url = str(avatar) if isinstance(avatar, str) else None
    try:
        user.github_access_token_enc = encrypt_token(access_token)
    except RuntimeError:
        return _settings_redirect("error")
    user.github_connected_at = now
    user.updated_at = now
    await repo.save(user)
    return _settings_redirect("connected")


async def get_status(current_user: CurrentUser) -> GitHubStatusResponse:
    connected = bool(current_user.github_access_token_enc)
    return GitHubStatusResponse(
        connected=connected,
        login=current_user.github_login if connected else None,
        avatarUrl=current_user.github_avatar_url if connected else None,
    )


async def disconnect(current_user: CurrentUser, repo: UserRepo) -> GitHubStatusResponse:
    if not current_user.id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    current_user.github_id = None
    current_user.github_login = None
    current_user.github_avatar_url = None
    current_user.github_access_token_enc = None
    current_user.github_connected_at = None
    current_user.updated_at = datetime.now(UTC)
    await repo.save(current_user)
    return GitHubStatusResponse(connected=False, login=None, avatarUrl=None)


async def list_repos(
    current_user: CurrentUser,
    repo: UserRepo,
    *,
    page: int = 1,
    per_page: int = 30,
    q: str | None = None,
) -> GitHubReposResponse:
    token = _require_connected_token(current_user)
    try:
        raw_repos = await fetch_github_repos(token, page=page, per_page=per_page)
    except PermissionError as exc:
        current_user.github_access_token_enc = None
        current_user.github_connected_at = None
        current_user.updated_at = datetime.now(UTC)
        await repo.save(current_user)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "github_token_invalid",
                "message": "GitHub authorization expired; reconnect GitHub",
            },
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch repositories from GitHub",
        ) from exc

    query = (q or "").strip().lower()
    items: list[GitHubRepoItem] = []
    for repo_doc in raw_repos:
        owner = repo_doc.get("owner") or {}
        owner_login = str(owner.get("login") or "")
        owner_avatar = owner.get("avatar_url")
        item = GitHubRepoItem(
            id=int(repo_doc.get("id") or 0),
            name=str(repo_doc.get("name") or ""),
            full_name=str(repo_doc.get("full_name") or ""),
            private=bool(repo_doc.get("private")),
            html_url=str(repo_doc.get("html_url") or ""),
            clone_url=str(repo_doc.get("clone_url") or ""),
            default_branch=str(repo_doc.get("default_branch") or "main"),
            description=(
                str(repo_doc["description"])
                if repo_doc.get("description") is not None
                else None
            ),
            owner_login=owner_login,
            owner_avatar_url=str(owner_avatar) if isinstance(owner_avatar, str) else None,
            updated_at=(
                str(repo_doc["updated_at"])
                if repo_doc.get("updated_at") is not None
                else None
            ),
        )
        if query and query not in item.full_name.lower() and query not in (
            item.description or ""
        ).lower():
            continue
        items.append(item)

    return GitHubReposResponse(repos=items)
