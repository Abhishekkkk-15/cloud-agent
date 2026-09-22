import asyncio
from pathlib import Path
from typing import Any, Optional
from pi_sdk import ToolSpec

from src.services.workspace_git import WorkspaceGitError, WorkspaceGitService


def _truncate_output(text: str, max_chars: int = 4000) -> str:
    if len(text) > max_chars:
        half = max_chars // 2
        return (
            text[:half]
            + f"\n\n... [Output truncated ({len(text) - max_chars} characters omitted) to save context tokens] ...\n\n"
            + text[-half:]
        )
    return text


def build_git_tools(
    host_path: Path,
    author_name: str = "Cloud Agent",
    author_email: str = "agent@users.noreply.github.com",
    on_push: Optional[Any] = None,
) -> list[ToolSpec]:
    git_service = WorkspaceGitService(host_path)

    # 1. git_status
    async def status_handler(**_: object) -> str:
        def _run_status() -> str:
            if not git_service.is_git_repo():
                return "Not a git repository."
            res = git_service._run(["status", "--short", "--branch"], check=False)
            output = res.stdout.strip() if res.returncode == 0 else res.stderr.strip()
            if not output:
                return "Working tree clean, on current branch."
            return output

        return await asyncio.to_thread(_run_status)

    git_status_tool = ToolSpec(
        name="git_status",
        description="Show the working tree status, current branch, and staged/unstaged changes.",
        parameters={
            "type": "object",
            "properties": {},
        },
        handler=status_handler,
        require_permission=False,
    )

    # 2. git_diff
    async def diff_handler(
        path: Optional[str] = None,
        staged: bool = False,
        **_: object,
    ) -> str:
        def _run_diff() -> str:
            if not git_service.is_git_repo():
                return "Not a git repository."
            cmd = ["diff"]
            if staged:
                cmd.append("--cached")
            if path:
                cmd.extend(["--", path.strip().lstrip("/")])
            else:
                # Automatically exclude lockfiles and generated maps to prevent context bloat
                cmd.extend([
                    "--",
                    ".",
                    ":(exclude)package-lock.json",
                    ":(exclude)pnpm-lock.yaml",
                    ":(exclude)yarn.lock",
                    ":(exclude)bun.lockb",
                    ":(exclude)*.map",
                ])
            res = git_service._run(cmd, check=False)
            out = res.stdout if res.returncode == 0 else res.stderr
            if not out.strip():
                return "No differences found (excluding lockfiles)."
            return _truncate_output(out)

        return await asyncio.to_thread(_run_diff)

    git_diff_tool = ToolSpec(
        name="git_diff",
        description="Show changes between commits, commit and working tree, or staged changes.",
        parameters={
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Optional file or folder path to inspect diff for.",
                },
                "staged": {
                    "type": "boolean",
                    "description": "If true, show staged/cached changes ready for commit (default: false).",
                },
            },
        },
        handler=diff_handler,
        require_permission=False,
    )

    # 3. git_commit
    async def commit_handler(
        message: str,
        files: Optional[list[str]] = None,
        **_: object,
    ) -> str:
        def _run_commit() -> str:
            if not git_service.is_git_repo():
                return "Error: Workspace is not a git repository."
            if not message or not message.strip():
                return "Error: Commit message cannot be empty."

            # Stage files
            if files and len(files) > 0:
                clean_files = [f.strip().lstrip("/") for f in files if f.strip()]
                git_service._run(["add", *clean_files], check=True)
            else:
                git_service._run(["add", "-A"], check=True)

            if not git_service.has_changes():
                # Check if there is staged content ready to commit
                staged_check = git_service._run(["diff", "--cached", "--quiet"], check=False)
                if staged_check.returncode == 0:
                    return "No changes to commit (working tree clean)."

            commit_env = {
                "GIT_AUTHOR_NAME": author_name,
                "GIT_AUTHOR_EMAIL": author_email,
                "GIT_COMMITTER_NAME": author_name,
                "GIT_COMMITTER_EMAIL": author_email,
            }
            res = git_service._run(
                ["commit", "--no-verify", "-m", message.strip()],
                env=commit_env,
                check=False,
            )
            if res.returncode != 0:
                return f"Commit failed: {res.stderr.strip()}"
            return res.stdout.strip() or "Committed successfully."

        try:
            return await asyncio.to_thread(_run_commit)
        except Exception as e:
            return f"Error executing git commit: {str(e)}"

    git_commit_tool = ToolSpec(
        name="git_commit",
        description="Record changes to the repository by staging files and creating a git commit.",
        parameters={
            "type": "object",
            "properties": {
                "message": {
                    "type": "string",
                    "description": "Clear, descriptive commit message explaining the changes.",
                },
                "files": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional specific list of file paths to stage and commit. Defaults to all modified files if omitted.",
                },
            },
            "required": ["message"],
        },
        handler=commit_handler,
        require_permission=False,
    )

    # 4. git_log
    async def log_handler(max_count: int = 10, **_: object) -> str:
        def _run_log() -> str:
            if not git_service.is_git_repo():
                return "Not a git repository."
            res = git_service._run(
                [
                    "log",
                    f"-n{max(1, min(max_count, 50))}",
                    "--pretty=format:%h - %an (%ar): %s",
                ],
                check=False,
            )
            if res.returncode != 0:
                return f"No commits yet or failed to get log: {res.stderr.strip()}"
            return res.stdout.strip() or "No commits in repository."

        return await asyncio.to_thread(_run_log)

    git_log_tool = ToolSpec(
        name="git_log",
        description="Show recent commit logs and history.",
        parameters={
            "type": "object",
            "properties": {
                "max_count": {
                    "type": "integer",
                    "description": "Number of commits to return (default: 10, max: 50).",
                },
            },
        },
        handler=log_handler,
        require_permission=False,
    )

    # 5. git_branch
    async def branch_handler(
        action: str = "list",
        name: Optional[str] = None,
        **_: object,
    ) -> str:
        def _run_branch() -> str:
            if not git_service.is_git_repo():
                return "Not a git repository."
            act = action.strip().lower()

            if act == "list":
                res = git_service._run(["branch", "-a"], check=False)
                return res.stdout.strip() or "No branches found."

            if act == "create":
                if not name or not name.strip():
                    return "Error: Branch name is required to create a branch."
                clean_name = name.strip()
                res = git_service._run(["checkout", "-b", clean_name], check=False)
                if res.returncode != 0:
                    return f"Failed to create branch: {res.stderr.strip()}"
                return res.stderr.strip() or res.stdout.strip() or f"Created and switched to branch {clean_name}."

            if act == "switch":
                if not name or not name.strip():
                    return "Error: Branch name is required to switch branches."
                clean_name = name.strip()
                res = git_service._run(["checkout", clean_name], check=False)
                if res.returncode != 0:
                    return f"Failed to switch branch: {res.stderr.strip()}"
                return res.stderr.strip() or res.stdout.strip() or f"Switched to branch {clean_name}."

            return f"Unknown action: '{action}'. Allowed: 'list', 'create', 'switch'."

        try:
            return await asyncio.to_thread(_run_branch)
        except Exception as e:
            return f"Error executing git branch: {str(e)}"

    git_branch_tool = ToolSpec(
        name="git_branch",
        description="List existing branches, create a new branch, or switch branches.",
        parameters={
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["list", "create", "switch"],
                    "description": "Action to perform: 'list' (default), 'create' (creates and checks out), or 'switch'.",
                },
                "name": {
                    "type": "string",
                    "description": "Name of the branch to create or switch to.",
                },
            },
        },
        handler=branch_handler,
        require_permission=False,
    )

    # 6. git_restore
    async def restore_handler(
        paths: Optional[list[str]] = None,
        staged: bool = False,
        **_: object,
    ) -> str:
        def _run_restore() -> str:
            if not git_service.is_git_repo():
                return "Not a git repository."

            target_paths = [p.strip().lstrip("/") for p in paths] if paths else ["."]
            cmd = ["restore"]
            if staged:
                cmd.append("--staged")
            cmd.extend(["--", *target_paths])

            res = git_service._run(cmd, check=False)
            if res.returncode != 0:
                # Fallback to checkout for older git compatibility
                if not staged:
                    res = git_service._run(["checkout", "--", *target_paths], check=False)
                    if res.returncode == 0:
                        return f"Restored {', '.join(target_paths)}."
                return f"Failed to restore: {res.stderr.strip()}"
            return f"Restored {', '.join(target_paths)}."

        try:
            return await asyncio.to_thread(_run_restore)
        except Exception as e:
            return f"Error executing git restore: {str(e)}"

    git_restore_tool = ToolSpec(
        name="git_restore",
        description="Discard changes in working tree or unstage files (safe rollback).",
        parameters={
            "type": "object",
            "properties": {
                "paths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "File or folder paths to restore (defaults to all changed files if omitted).",
                },
                "staged": {
                    "type": "boolean",
                    "description": "If true, unstage changes from the index (default: false).",
                },
            },
        },
        handler=restore_handler,
        require_permission=False,
    )

    # 7. git_push
    async def push_handler(
        branch: Optional[str] = None,
        force: bool = False,
        **_: object,
    ) -> str:
        if on_push is None:
            return "Error: Git push is not configured for this session."
        try:
            return await on_push(branch=branch, force=force)
        except Exception as e:
            return f"Error pushing to remote: {str(e)}"

    git_push_tool = ToolSpec(
        name="git_push",
        description="Push committed changes to the remote repository (GitHub). Always commit before pushing.",
        parameters={
            "type": "object",
            "properties": {
                "branch": {
                    "type": "string",
                    "description": "Optional branch name to push (defaults to current active branch or 'main').",
                },
                "force": {
                    "type": "boolean",
                    "description": "If true, force push with lease (default: false). Use with caution.",
                },
            },
        },
        handler=push_handler,
        require_permission=False,
    )

    return [
        git_status_tool,
        git_diff_tool,
        git_commit_tool,
        git_log_tool,
        git_branch_tool,
        git_restore_tool,
        git_push_tool,
    ]
