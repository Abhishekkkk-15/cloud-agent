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


def _slug_repo_name(value: str, *, max_len: int = 60) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9-]+", "-", (value or "").strip().lower())
    cleaned = re.sub(r"-{2,}", "-", cleaned).strip("-")
    return cleaned[:max_len].strip("-")


def suggest_repo_name(workspace: Workspace) -> str:
    """GitHub repo name = kebab-case of the workspace title (same product name)."""
    base = _slug_repo_name(workspace.title or "", max_len=60)
    if base and base not in {"workspace", "project", "app", "new"}:
        return base
    prompt = _slug_repo_name(
        " ".join((workspace.initial_prompt or "").split()[:6]),
        max_len=40,
    )
    return prompt or "cloud-app"


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


async def _create_unique_repo(
    token: str,
    *,
    base_name: str,
    workspace: Workspace,
) -> dict:
    """Create a repo; on name conflict append a short workspace-id suffix."""
    description = workspace.title or "Created by Cloud Agent"
    candidates = [base_name]
    wid = (workspace.id or "")[-6:]
    if wid:
        candidates.append(_slug_repo_name(f"{base_name}-{wid}", max_len=60))
    candidates.append(_slug_repo_name(f"{base_name}-{wid or 'app'}-1", max_len=60))

    last_error: Exception | None = None
    for name in candidates:
        if not name:
            continue
        try:
            return await create_github_repo(
                token,
                name=name,
                private=True,
                auto_init=False,
                description=description,
            )
        except GitHubAPIError as exc:
            last_error = exc
            # 422 = validation failed (often name already exists)
            if exc.status_code != 422:
                raise
            logger.info("GitHub repo name %r taken; trying another", name)
            continue
    if last_error:
        raise last_error
    raise GitHubAPIError(500, "Failed to create GitHub repository")


async def ensure_workspace_repo(
    user: User,
    workspace: Workspace,
    workspace_repo: WorkspaceRepository,
) -> tuple[Workspace, str | None]:
    """Ensure remote GitHub repository and clone_url exist, returning auth token if available."""
    try:
        auth = await resolve_github_auth(user, workspace)
        if not workspace.github_clone_url:
            repo_name = suggest_repo_name(workspace)
            data = await _create_unique_repo(
                auth.token,
                base_name=repo_name,
                workspace=workspace,
            )
            _apply_repo_payload(workspace, data, auth_source=auth.source)

        if not workspace.github_auth_source:
            workspace.github_auth_source = auth.source

        workspace.source_path = str(host_workspace_path(workspace))
        workspace = await workspace_repo.save(workspace)

        # Ensure git init and remote on host
        host_path = host_workspace_path(workspace)
        git = WorkspaceGitService(host_path)
        git.init()
        git.ensure_gitignore()
        if workspace.github_clone_url:
            git.set_remote(workspace.github_clone_url)

        return workspace, auth.token
    except Exception as exc:
        logger.warning("ensure_workspace_repo error: %s", exc)
        return workspace, None


async def sync_workspace_to_github(
    user: User,
    workspace: Workspace,
    workspace_repo: WorkspaceRepository,
    *,
    message: str = "cloud-agent sync",
) -> tuple[Workspace, GithubSyncResult]:
    """Ensure a GitHub remote exists, commit+push host files, persist workspace fields.

    Mutates and saves ``workspace``. Best-effort friendly: returns ok=False on failure
    instead of raising, so callers (e.g. chat_ws) can continue.
    """
    auth_source: Literal["user", "platform"] | None = workspace.github_auth_source

    try:
        auth = await resolve_github_auth(user, workspace)
        auth_source = auth.source

        if not workspace.github_clone_url:
            repo_name = suggest_repo_name(workspace)
            data = await _create_unique_repo(
                auth.token,
                base_name=repo_name,
                workspace=workspace,
            )
            _apply_repo_payload(workspace, data, auth_source=auth.source)

        if not workspace.github_auth_source:
            workspace.github_auth_source = auth.source

        workspace.source_path = str(host_workspace_path(workspace))
        workspace = await workspace_repo.save(workspace)

        if not workspace.github_clone_url:
            return workspace, GithubSyncResult(
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
        return  workspace,GithubSyncResult(
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
        return workspace, GithubSyncResult(
            ok=False,
            committed=False,
            auth_source=auth_source,
            repo_full_name=workspace.github_repo_full_name,
            error=exc.message,
            error_code=exc.code,
        )
    except (WorkspaceGitError, GitHubAPIError) as exc:
        logger.exception("Git sync failed for workspace %s", workspace.id)
        return  workspace,GithubSyncResult(
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
        return  workspace,GithubSyncResult(
            ok=False,
            committed=False,
            auth_source=auth_source,
            repo_full_name=workspace.github_repo_full_name,
            error=str(exc),
            error_code="github_sync_error",
        )
