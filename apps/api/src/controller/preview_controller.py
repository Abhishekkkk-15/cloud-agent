from fastapi import HTTPException, responses

from src.dependency.auth_dependency import CurrentUser
from src.dependency.port_depemdency import PortRepo
from src.dependency.sandbox_dependency import SandboxRepo
from src.repository.workspace_repository import WorkspaceRepo
from src.utils.port_manager import PortRole


async def start_preview(
    workspace_id: str,
    current_user: CurrentUser,
    repo: WorkspaceRepo,
    sandbox_manager: SandboxRepo,
    port_manager: PortRepo,
):
    """Start the frontend (and optionally backend) using ports published at sandbox create.

    Ports cannot be added after the container exists — use workspace.frontend_port /
    backend_port (container 4000 / 4001) allocated when the sandbox was started.
    """
    workspace = await repo.find_by_id(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    if not workspace.sandbox_id:
        raise HTTPException(status_code=404, detail="Sandbox not found")

    sandbox = sandbox_manager.sandbox_get(workspace.sandbox_id)
    if not sandbox:
        raise HTTPException(status_code=404, detail="Sandbox not found")

    # Prefer persisted workspace ports; rehydrate PortManager if API restarted
    frontend = port_manager.get_workspace_port(workspace_id, PortRole.FRONTEND)
    backend = port_manager.get_workspace_port(workspace_id, PortRole.BACKEND)

    if workspace.frontend_port is None or workspace.backend_port is None:
        if not frontend or not backend:
            raise HTTPException(
                status_code=409,
                detail=(
                    "No published ports for this workspace. "
                    "Recreate the sandbox so frontend:4000 and backend:4001 are mapped."
                ),
            )
        workspace.frontend_port = frontend.host_port
        workspace.backend_port = backend.host_port
        workspace.preview_port = frontend.host_port
        workspace.preview_url = frontend.url
        workspace.backend_url = backend.url

    frontend_host = workspace.frontend_port
    backend_host = workspace.backend_port

    workspace.preview_status = "starting"
    await repo.save(workspace)

    # Bind inside the container to fixed ports that were published at create time
    front_cmd = (
        f"npm run dev -- --host 0.0.0.0 --port 4000"
    )
    # Best-effort start; caller can refine per-project scripts later
    sandbox_manager.run_exec(sandbox_id=sandbox.id, cmd=front_cmd)

    workspace.preview_port = frontend_host
    workspace.preview_url = f"http://127.0.0.1:{frontend_host}"
    workspace.backend_url = (
        f"http://127.0.0.1:{backend_host}" if backend_host else None
    )
    workspace.preview_status = "started"
    await repo.save(workspace)

    return responses.JSONResponse(
        content={
            "frontend": {
                "container_port": 4000,
                "host_port": frontend_host,
                "url": workspace.preview_url,
            },
            "backend": {
                "container_port": 4001,
                "host_port": backend_host,
                "url": workspace.backend_url,
            },
            "workspace_id": workspace_id,
            "preview_status": workspace.preview_status,
        }
    )
