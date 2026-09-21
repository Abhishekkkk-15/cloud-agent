import asyncio
import os
from pathlib import Path
import shutil
import stat
import subprocess
import time

from src.dependency.sandbox_dependency import get_sandbox_manager
from src.repository.workspace_repository import create_workspace_repo
from src.utils import db_client as db_module

sandbox = get_sandbox_manager()

_cleanup_tasks: dict[str, asyncio.Task] = {}


def _handle_remove_readonly(func, path, exc_info):
    """Error handler for shutil.rmtree to clear read-only attributes on Windows."""
    try:
        os.chmod(path, stat.S_IWRITE | stat.S_IREAD)
        func(path)
    except Exception:
        pass


def safe_rmtree(path: str | Path, max_retries: int = 3, retry_delay: float = 0.5) -> None:
    """Safely delete directory trees, clearing read-only attributes and retrying on lock delay."""
    p = Path(path)
    if not p.exists():
        return

    for _ in range(max_retries):
        try:
            for root, dirs, files in os.walk(p):
                for f in files:
                    try:
                        os.chmod(os.path.join(root, f), stat.S_IWRITE | stat.S_IREAD)
                    except Exception:
                        pass
                for d in dirs:
                    try:
                        os.chmod(os.path.join(root, d), stat.S_IWRITE | stat.S_IREAD | stat.S_IEXEC)
                    except Exception:
                        pass

            try:
                shutil.rmtree(p, onexc=_handle_remove_readonly)
            except TypeError:
                shutil.rmtree(p, onerror=_handle_remove_readonly)

            if not p.exists():
                return
        except Exception:
            pass

        time.sleep(retry_delay)

    # Windows fallback
    if p.exists() and os.name == "nt":
        try:
            subprocess.run(
                ["cmd.exe", "/c", "rd", "/s", "/q", str(p.resolve())],
                check=False,
                capture_output=True,
            )
        except Exception as e:
            print(f"[safe_rmtree] cmd rd fallback failed: {e}")


async def stop_sandbox_worker(
    workspace_id: str,
    version: int,
) -> None:
    try:
        if db_module.db_client is None:
            print("[STOP] Database client not initialized")
            return

        ws_repo = create_workspace_repo(db_module.db_client)

        ws = await ws_repo.find_by_id(workspace_id)

        if not ws:
            print(f"Workspace {workspace_id} not found")
            return

        if not ws.sandbox_id:
            return

        if ws.version != version:
            print(
                f"[STOP] Version mismatch. "
                f"Expected={version}, Current={ws.version}"
            )
            return

        sandbox.stop_sandbox(ws.sandbox_id)

        print(
            f"[STOP] Sandbox stopped for workspace "
            f"{workspace_id}"
        )

    except Exception as e:
        print(f"[STOP ERROR] {e}")


async def delete_sandbox_worker(
    workspace_id: str,
    version: int,
) -> None:
    try:
        if db_module.db_client is None:
            print("[DELETE] Database client not initialized")
            return

        ws_repo = create_workspace_repo(db_module.db_client)

        ws = await ws_repo.find_by_id(workspace_id)

        if not ws:
            print(f"Workspace {workspace_id} not found")
            return

        if not ws.sandbox_id:
            return

        if ws.version != version:
            print(
                f"[DELETE] Version mismatch. "
                f"Expected={version}, Current={ws.version}"
            )
            return

        sandbox.delete_sandbox(ws.sandbox_id)

        if ws.source_path:
            safe_rmtree(ws.source_path)

        ws.sandbox_id = None
        await ws_repo.save(ws)

        print(
            f"[DELETE] Workspace deleted "
            f"{workspace_id}"
        )

    except FileNotFoundError:
        print("Workspace folder does not exist")

    except PermissionError:
        print("No permission to delete workspace folder")

    except Exception as e:
        print(f"[DELETE ERROR] {e}")


async def _container_cleanup_task(
    workspace_id: str,
    version: int,
) -> None:
    try:
        # stop after 10 minutes
        print("GOT IN CLEAN UP ")
        await asyncio.sleep(1 * 60)

        await stop_sandbox_worker(
            workspace_id,
            version,
        )

        # delete after another 10 minutes
        await asyncio.sleep(20 * 60)

        await delete_sandbox_worker(
            workspace_id,
            version,
        )

    finally:
        _cleanup_tasks.pop(workspace_id, None)


def container_lifecycle_manager(
    workspace_id: str,
    version: int,
) -> asyncio.Task:
    old_task = _cleanup_tasks.get(workspace_id)

    if old_task and not old_task.done():
        old_task.cancel()

    task = asyncio.create_task(
        _container_cleanup_task(
            workspace_id,
            version,
        )
    )

    _cleanup_tasks[workspace_id] = task

    return task