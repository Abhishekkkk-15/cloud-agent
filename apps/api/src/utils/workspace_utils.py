import asyncio
import logging
import shutil
from pathlib import Path

from src.ai_core.sandbox.client import get_sandbox_client
from src.models.user_model import User
from src.models.workspace_model import Workspace
from src.services.workspace_git import WorkspaceGitError, WorkspaceGitService
from src.utils.config import config
from src.utils.github_oauth import resolve_github_auth

logger = logging.getLogger(__name__)

TEMPLATE_DIR = (
    Path(__file__).resolve().parent.parent
    / "ai_core"
    / "sandbox"
    / "sandbox"
    / "template"
)


def is_empty_dir(p: Path) -> bool:
    if not p.exists() or not p.is_dir():
        return True
    return not any(p.iterdir())


def host_path_for_workspace(workspace: Workspace) -> Path:
    if not workspace.id:
        raise WorkspaceGitError("workspace.id is required to prepare files")
    return config.workspace_base / workspace.id


async def prepare_workspace(
    user: User,
    workspace: Workspace,
    container_id: Optional[str] = None,
) -> Path | str:
    """Ensure workspace files exist: seed template or clone imported repo.

    If container_id is provided, executes entirely inside the Docker container (/app),
    preventing any untrusted repository files or git scripts from touching the host.
    """
    if container_id:
        git = WorkspaceGitService(container_id=container_id, workdir="/app")
        if workspace.workspace_origin == "template":
            # Container entrypoint seeds /template into /app when empty
            await asyncio.to_thread(git.init)
            await asyncio.to_thread(git.ensure_gitignore)
            if workspace.github_clone_url:
                await asyncio.to_thread(git.set_remote, workspace.github_clone_url)
            return "/app"

        if workspace.workspace_origin == "github_import":
            if not workspace.github_clone_url:
                raise WorkspaceGitError("github clone url missing")

            if workspace.github_auth_source is None:
                workspace.github_auth_source = "user"

            auth = await resolve_github_auth(user, workspace)
            if git.is_git_repo():
                logger.info(
                    "Import workspace %s already cloned in container %s",
                    workspace.id,
                    container_id,
                )
                return "/app"

            branch = workspace.github_default_branch or "main"
            await asyncio.to_thread(
                git.clone,
                auth.token,
                workspace.github_clone_url,
                branch,
            )
            return "/app"

        raise WorkspaceGitError(f"Unknown workspace_origin: {workspace.workspace_origin!r}")

    # Fallback to host prepare if container_id not specified
    host_path = host_path_for_workspace(workspace)

    if workspace.workspace_origin == "template":
        ensure_workspace_template(workspace.id)  # type: ignore[arg-type]
        WorkspaceGitService(host_path).init()
        return host_path

    if workspace.workspace_origin == "github_import":
        if not workspace.github_clone_url:
            raise WorkspaceGitError("github clone url missing")

        # Imports always use the user's GitHub credentials.
        if workspace.github_auth_source is None:
            workspace.github_auth_source = "user"

        auth = await resolve_github_auth(user, workspace)
        git = WorkspaceGitService(host_path)

        if git.is_git_repo():
            logger.info("Import workspace %s already cloned at %s", workspace.id, host_path)
            return host_path

        if host_path.exists() and not is_empty_dir(host_path):
            raise WorkspaceGitError(
                f"Import path is non-empty and not a git repo: {host_path}"
            )

        branch = workspace.github_default_branch or "main"
        await asyncio.to_thread(
            git.clone,
            auth.token,
            workspace.github_clone_url,
            branch,
        )
        return host_path

    raise WorkspaceGitError(f"Unknown workspace_origin: {workspace.workspace_origin!r}")


async def restore_workspace_from_github(
    user: User,
    workspace: Workspace,
    container_id: Optional[str] = None,
) -> Path | str:
    """Ensure workspace directory exists and has project files.

    If container_id is provided, executes entirely inside the Docker container (/app).
    """
    if container_id:
        git = WorkspaceGitService(container_id=container_id, workdir="/app")
        if git.is_git_repo():
            logger.info(
                "Workspace %s already has git repository in container %s",
                workspace.id,
                container_id,
            )
            return "/app"

        if workspace.github_clone_url:
            logger.info(
                "Restoring workspace %s from GitHub in container %s: %s",
                workspace.id,
                container_id,
                workspace.github_clone_url,
            )
            auth = await resolve_github_auth(user, workspace)
            branch = workspace.github_default_branch or "main"
            client = get_sandbox_client()
            if client:
                try:
                    c = client.containers.get(container_id)
                    c.exec_run("sh -c 'rm -rf /app/* /app/.* 2>/dev/null || true'")
                except Exception as clean_err:
                    logger.warning("Error cleaning container /app before clone: %s", clean_err)
            await asyncio.to_thread(
                git.clone,
                auth.token,
                workspace.github_clone_url,
                branch,
            )
            return "/app"

        return await prepare_workspace(user, workspace, container_id=container_id)

    # Fallback to host restore if container_id not specified
    host_path = host_path_for_workspace(workspace)
    git = WorkspaceGitService(host_path)

    # 1. If host files already exist as a git repository, don't re-clone or wipe
    if git.is_git_repo():
        logger.info("Workspace %s already has git repository at %s", workspace.id, host_path)
        return host_path

    # 2. If a GitHub repo is already associated, clone it using appropriate credentials
    if workspace.github_clone_url:
        logger.info("Restoring workspace %s from GitHub: %s", workspace.id, workspace.github_clone_url)
        auth = await resolve_github_auth(user, workspace)
        branch = workspace.github_default_branch or "main"

        # If directory exists but is empty or broken, clean it up before clone
        if host_path.exists() and is_empty_dir(host_path):
            try:
                host_path.rmdir()
            except Exception:
                pass

        await asyncio.to_thread(
            git.clone,
            auth.token,
            workspace.github_clone_url,
            branch,
        )
        return host_path

    # 3. No GitHub repository linked yet — fall back to standard prepare
    return await prepare_workspace(user, workspace)



def ensure_workspace_template(workspace_id: str) -> Path:
    """Pre-seed workspace directory on host with project template files.

    This ensures that /app on the container has package.json, server, src, etc.
    immediately upon mounting, avoiding slow cross-mount copying during container boot.
    """
    workspace_root = config.workspace_base / workspace_id
    workspace_root.mkdir(parents=True, exist_ok=True)
    try:
        current = workspace_root.resolve()
        for p in [current, *current.parents]:
            if p.exists():
                try:
                    p.chmod(p.stat().st_mode | 0o777)
                except Exception:
                    pass
            if p.parent == p:
                break
    except Exception:
        pass

    package_json = workspace_root / "package.json"
    if not package_json.exists() and TEMPLATE_DIR.exists():
        logger.info(
            "Seeding workspace template for %s from %s",
            workspace_id,
            TEMPLATE_DIR,
        )
        for item in TEMPLATE_DIR.iterdir():
            if item.name == "node_modules":
                continue
            dest = workspace_root / item.name
            if not dest.exists():
                try:
                    if item.is_dir():
                        shutil.copytree(item, dest)
                    else:
                        shutil.copy2(item, dest)
                except Exception as e:
                    logger.warning("Failed copying %s to %s: %s", item.name, dest, e)

    # Ensure all newly seeded or existing files/directories have full permissions
    try:
        for root, dirs, files in os.walk(workspace_root):
            for d in dirs:
                try:
                    os.chmod(os.path.join(root, d), 0o777)
                except Exception:
                    pass
            for f in files:
                try:
                    os.chmod(os.path.join(root, f), 0o666)
                except Exception:
                    pass
    except Exception:
        pass

    return workspace_root
