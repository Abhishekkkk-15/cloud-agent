import asyncio
import shutil

from src.dependency.sandbox_dependency import get_sandbox_manager
from src.repository.workspace_repository import create_workspace_repo
from src.utils.db_client import db_client

sandbox = get_sandbox_manager()

_cleanup_tasks: dict[str, asyncio.Task] = {}


async def stop_sandbox_worker(
    workspace_id: str,
    version: int,
) -> None:
    try:
        ws_repo = create_workspace_repo(db_client)

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
        ws_repo = create_workspace_repo(db_client)

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
            shutil.rmtree(ws.source_path)

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
        await asyncio.sleep(10 * 60)

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