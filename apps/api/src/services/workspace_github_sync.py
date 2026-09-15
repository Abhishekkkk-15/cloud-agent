"""Orchestrate ensure-repo + host git sync for a workspace.

Runs outside the sandbox: tokens never enter the container.
"""

from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel

from src.models.user_model import User
from src.models.workspace_model import Workspace
from src.repository.workspace_repository import WorkspaceRepository
from src.services.workspace_git import WorkspaceGitError, WorkspaceGitService
from src.utils.config import config
from src.utils.github_oauth import (
    GitHubAPIError,
    GitHubAuthError,
    create_github_repo,
    resolve_github_auth,
)

logger = logging.getLogger(__name__)


class GithubSyncResult(BaseModel):
    ok: bool
    committed: bool
    auth_source: Literal["user", "platform"] | None
    repo_full_name: str | None
    error: Optional[str] = None
    # String codes (e.g. github_not_connected, git_sync_failed) — not HTTP ints.
    error_code: Optional[str] = None


def host_workspace_path(workspace: Workspace) -> Path:
    if workspace.id:
        return config.workspace_base / workspace.id
    if workspace.source_path:
        return Path(workspace.source_path)
    raise WorkspaceGitError("Workspace has no id or source_path")


def _slug(value: str, *, max_len: int) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", value.strip()).strip("-._")
    return cleaned[:max_len]


def suggest_repo_name(user: User, workspace: Workspace) -> str:
    parts: list[str] = []
    if user.username:
        parts.append(_slug(user.username, max_len=24))
    if workspace.title:
        parts.append(_slug(workspace.title, max_len=32))
    wid = _slug(workspace.id or "workspace", max_len=24) or "workspace"
    parts.append(wid)
    name = "-".join(p for p in parts if p) or wid
    return name[:100].strip("-._") or wid


def _apply_repo_payload(workspace: Workspace, data: dict, *, auth_source: Literal["user", "platform"]) -> None:
    owner = data.get("owner") or {}
    workspace.github_owner = str(owner.get("login") or workspace.github_owner or "")
    workspace.github_name = str(data.get("name") or "")
    workspace.github_repo_full_name = str(
        data.get("full_name")
        or (
            f"{workspace.github_owner}/{workspace.github_name}"
            if workspace.github_owner and workspace.github_name
            else ""
        )
    )
    workspace.github_repo_url = str(data.get("html_url") or "")
    workspace.github_clone_url = str(data.get("clone_url") or "")
    workspace.github_default_branch = str(data.get("default_branch") or "main")
    workspace.github_auth_source = auth_source


def _has_commits(git: WorkspaceGitService) -> bool:
    result = git._run(["rev-parse", "--verify", "HEAD"], check=False)
    return result.returncode == 0


def _sync_blocking(
    host_path: Path,
    *,
    token: str,
    clone_url: str,
    branch: str,
    message: str,
    author_name: str,
    author_email: str,
) -> bool:
    host_path.mkdir(parents=True, exist_ok=True)
    git = WorkspaceGitService(host_path)
    git.init()
    git.ensure_gitignore()
    git.set_remote(clone_url)
    committed = git.commit_all(
        message,
        author_name=author_name,
        author_email=author_email,
    )
    if not _has_commits(git):
        return False
    git.push(token, branch=branch)
    return committed


async def sync_workspace_to_github(
    user: User,
    workspace: Workspace,
    workspace_repo: WorkspaceRepository,
    *,
    message: str = "cloud-agent sync",
) -> GithubSyncResult:
    """Ensure a GitHub remote exists, commit+push host files, persist workspace fields.

    Mutates and saves ``workspace``. Best-effort friendly: returns ok=False on failure
    instead of raising, so callers (e.g. chat_ws) can continue.
    """
    auth_source: Literal["user", "platform"] | None = workspace.github_auth_source

    try:
        auth = await resolve_github_auth(user, workspace)
        auth_source = auth.source

        if not workspace.github_clone_url:
            data = await create_github_repo(
                auth.token,
                name=suggest_repo_name(user, workspace),
                private=True,
                auto_init=False,
                description=workspace.title or "Created by Cloud Agent",
            )
            _apply_repo_payload(workspace, data, auth_source=auth.source)

        if not workspace.github_auth_source:
            workspace.github_auth_source = auth.source

        workspace.source_path = str(host_workspace_path(workspace))
        workspace = await workspace_repo.save(workspace)

        if not workspace.github_clone_url:
            return GithubSyncResult(
                ok=False,
                committed=False,
                auth_source=auth_source,
                repo_full_name=workspace.github_repo_full_name,
                error="Workspace has no github_clone_url after ensure",
                error_code="github_repo_missing",
            )

        branch = workspace.github_default_branch or "main"
        committed = await asyncio.to_thread(
            _sync_blocking,
            host_workspace_path(workspace),
            token=auth.token,
            clone_url=workspace.github_clone_url,
            branch=branch,
            message=message,
            author_name=auth.login,
            author_email=auth.email,
        )

        workspace = await workspace_repo.save(workspace)
        return GithubSyncResult(
            ok=True,
            committed=committed,
            auth_source=auth.source,
            repo_full_name=workspace.github_repo_full_name,
        )

    except GitHubAuthError as exc:
        logger.warning(
            "GitHub auth unavailable for workspace %s: %s",
            workspace.id,
            exc,
        )
        return GithubSyncResult(
            ok=False,
            committed=False,
            auth_source=auth_source,
            repo_full_name=workspace.github_repo_full_name,
            error=exc.message,
            error_code=exc.code,
        )
    except (WorkspaceGitError, GitHubAPIError) as exc:
        logger.exception("Git sync failed for workspace %s", workspace.id)
        return GithubSyncResult(
            ok=False,
            committed=False,
            auth_source=auth_source,
            repo_full_name=workspace.github_repo_full_name,
            error=str(exc),
            error_code="git_sync_failed",
        )
    except Exception as exc:
        logger.exception(
            "Unexpected GitHub sync failure for workspace %s",
            workspace.id,
        )
        return GithubSyncResult(
            ok=False,
            committed=False,
            auth_source=auth_source,
            repo_full_name=workspace.github_repo_full_name,
            error=str(exc),
            error_code="github_sync_error",
        )
