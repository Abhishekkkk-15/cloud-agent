from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt
from jwt.exceptions import InvalidTokenError

from src.utils.config import config
from src.utils.jwt_utils import SECRET_KEY, ALGORITHM

from typing import Optional,Dict
GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_API_BASE = "https://api.github.com"
GITHUB_SCOPES = "repo read:user"
OAUTH_STATE_TTL_MINUTES = 10

class GitHubAPIError(Exception):
    """Raised when GitHub API returns a non-2xx status code."""
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"GitHub API Error [{status_code}]: {detail}")

def ensure_github_oauth_configured() -> None:
    if not config.github_client_id or not config.github_client_secret:
        raise RuntimeError("GitHub OAuth is not configured")
    if not config.github_token_encryption_key:
        raise RuntimeError("GITHUB_TOKEN_ENCRYPTION_KEY is not configured")


def create_oauth_state(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=OAUTH_STATE_TTL_MINUTES)
    payload = {
        "sub": user_id,
        "type": "github_oauth",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_oauth_state(state: str) -> str:
    try:
        payload = jwt.decode(state, SECRET_KEY, algorithms=[ALGORITHM])
    except InvalidTokenError as exc:
        raise ValueError("Invalid or expired OAuth state") from exc
    if payload.get("type") != "github_oauth":
        raise ValueError("Invalid OAuth state type")
    user_id = payload.get("sub")
    if not user_id:
        raise ValueError("Invalid OAuth state payload")
    return str(user_id)


def build_authorize_url(state: str) -> str:
    ensure_github_oauth_configured()
    query = urlencode(
        {
            "client_id": config.github_client_id,
            "redirect_uri": config.github_oauth_callback_url,
            "scope": GITHUB_SCOPES,
            "state": state,
            "allow_signup": "true",
        }
    )
    return f"{GITHUB_AUTHORIZE_URL}?{query}"


async def exchange_code_for_token(code: str) -> str:
    ensure_github_oauth_configured()
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            GITHUB_TOKEN_URL,
            headers={"Accept": "application/json"},
            data={
                "client_id": config.github_client_id,
                "client_secret": config.github_client_secret,
                "code": code,
                "redirect_uri": config.github_oauth_callback_url,
            },
        )
        response.raise_for_status()
        data = response.json()

    access_token = data.get("access_token")
    if not access_token:
        error = data.get("error_description") or data.get("error") or "unknown error"
        raise ValueError(f"GitHub token exchange failed: {error}")
    return str(access_token)


async def github_api_get(
    path: str,
    access_token: str,
    *,
    params: dict[str, Any] | None = None,
) -> Any:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{GITHUB_API_BASE}{path}",
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {access_token}",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            params=params,
        )
        if response.status_code == 401:
            raise PermissionError("GitHub token is invalid or revoked")
        response.raise_for_status()
        return response.json()


async def fetch_github_user(access_token: str) -> dict[str, Any]:
    data = await github_api_get("/user", access_token)
    if not isinstance(data, dict):
        raise ValueError("Unexpected GitHub user response")
    return data


async def fetch_github_repos(
    access_token: str,
    *,
    page: int = 1,
    per_page: int = 30,
) -> list[dict[str, Any]]:
    data = await github_api_get(
        "/user/repos",
        access_token,
        params={
            "per_page": per_page,
            "page": page,
            "sort": "updated",
            "direction": "desc",
            "affiliation": "owner,collaborator,organization_member",
        },
    )
    if not isinstance(data, list):
        raise ValueError("Unexpected GitHub repos response")
    return data

async def github_api_post(
    endpoint: str,
    token: str,
    json_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Executes an authenticated HTTP POST request to the GitHub REST API.
    Token is passed exclusively via the Authorization header in memory.
    """
    url = f"https://api.github.com{endpoint}" if endpoint.startswith("/") else endpoint
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Cloud-Agent-App",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(url, headers=headers, json=json_data or {})

        if response.status_code not in (200, 201):
            try:
                error_body = response.json()
                message = error_body.get("message", response.text)
            except Exception:
                message = response.text
            raise GitHubAPIError(response.status_code, message)

        return response.json()


async def create_github_repo(
    token: str,
    name: str,
    private: bool = True,
    auto_init: bool = False,
    description: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Creates a new GitHub repository under the authenticated user's account.
    Returns the repository payload (including 'html_url' and 'clone_url').
    """
    payload = {
        "name": name,
        "private": private,
        "auto_init": auto_init,
        "description": description or "Created by Cloud Agent",
    }

    # Calls POST /user/repos to create repo for authenticated user
    repo_data = await github_api_post("/user/repos", token=token, json_data=payload)
    return repo_data