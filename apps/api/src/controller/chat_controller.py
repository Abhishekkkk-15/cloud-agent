from src.schemas.chat_schema import ChatMessageRequest
from src.repository.workspace_repository import WorkspaceRepo
from src.repository.session_repository import SessionRepo
from src.dependency.auth_dependency import CurrentUser
from src.ai_core.cloud_agent import CloudAgentCore
from src.models.workspace_model import Workspace
from fastapi import  HTTPException, status
from src.dependency.sandbox_dependency import SandboxRepo
from fastapi.sse import EventSourceResponse
from src.utils.config import config


async def start_chat(body:ChatMessageRequest,current_user: CurrentUser,workspace_repo:WorkspaceRepo,session_repo:SessionRepo, sandbox:SandboxRepo, w_id:str|None=None):
    # create a workspace
    # create agent
    # find intent of query for title of workspace using fast model, (skip for now)
    # model router (skip)
    # create and start a sandbox
    # take sandbox/container info and save to workspace
    # start agent in workspace
    if not current_user.id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authorized"
        )
    query_intent_title = "Building application"
    workspace_obj = Workspace(title=query_intent_title,user_id=current_user.id,target_path="/app",source_path="/app",sandbox_id="somid")
    workspace =await workspace_repo.create(workspace_obj)
    if not workspace.id:
        print(sandbox)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Something wrong with the server"
        )   
    workspace.source_path = str(config.workspace_base/workspace.id)
    workspace.target_path
    workspace_root = config.workspace_base/workspace.id
    workspace_root.mkdir(parents=True, exist_ok=True)
    sandbox = sandbox.run_sandbox(workspace_id=workspace.id)
    print(sandbox)
    if isinstance(sandbox,dict):
        print(sandbox)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Something wrong with the server"
        )
    
    
    workspace.sandbox_id = sandbox.id
    await workspace_repo.save(workspace)
    agent = CloudAgentCore(workspace.id,sandbox.id,current_user.id)
    res = await agent.run(msg=body.query)
    # agent = CloudAgentCore()
    # agent.run()
    return {"agent":res,"workspace":workspace}
    
    