from fastapi import HTTPException,responses
from src.dependency.auth_dependency import CurrentUser
from src.repository.workspace_repository import WorkspaceRepo
from src.dependency.sandbox_dependency import SandboxRepo
from src.dependency.port_depemdency import PortRepo

async def start_preview(workspace_id:str, current_user:CurrentUser, repo:WorkspaceRepo, sandbox_manager:SandboxRepo,port_manager:PortRepo):
    workspace = await repo.find_by_id(workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    sandbox = await sandbox_manager.sandbox_get(workspace.sandbox_id) # type:ignore
    if not sandbox:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    workspace.preview_status = "pending"
    port = port_manager.allocate_port(requested_port=None, workspace_id=workspace_id)
    sandbox_manager.run_exec(sandbox_id=sandbox.id, cmd=f"npm run dev -- --host=0.0.0.0 --port {port.port}")
    workspace.preview_port = port.port
    workspace.preview_status = "started"
    await repo.save(workspace)
    return responses.JSONResponse(content={"port":port,"workspace":workspace})
    
    
    