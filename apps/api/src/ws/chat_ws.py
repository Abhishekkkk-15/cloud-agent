from src.utils.ws_manager import ws_manager, ConnectionManager
from fastapi import APIRouter, WebSocket, WebSocketException
from src.utils.ws_manager import authenticate_websocket
from src.repository.user_repository import UserRepo
from src.dependency.sandbox_dependency import SandboxRepo
from src.repository.workspace_repository import WorkspaceRepo
from src.models.workspace_model import WorkspaceStatus
from src.utils.event_handler import event_handler
from pi_sdk import AgentEvent
from src.ai_core.cloud_agent import CloudAgentCore
from fastapi.encoders import jsonable_encoder
from src.utils.config import config
from src.schemas.sandbox_schema import SandboxRunResult

router = APIRouter()




async def websocket_endpoint(ws:WebSocket,user_repo:UserRepo,sandbox_repo:SandboxRepo,workspace_repo:WorkspaceRepo):
    
    # Recieve workspace id and session_id (if there is) from query
    # fetch workspace and session details
    # check if workspace sandbox/container is running (Event: Checking Sandbox Status)
    # if not sandbox start/create sandbox  (Event: Starting Sandbox container)
    # save container id
    # create agent with workspace_id
    
    await ws_manager.connect(ws)
    print("websocket connection setablished")
    
    while True:
        
        user = await authenticate_websocket(ws,user_repo)
        workspace_id = ws.query_params.get("workspace_id")
        text = await ws.receive()    
        print(text)
        if not workspace_id:
            raise WebSocketException(code=1008,reason="workspace is required")
        session_id = ws.query_params.get("session_id")
        workspace = await workspace_repo.find_by_id(workspace_id)
        if not workspace:
            raise WebSocketException(code=4004,reason="workspace not found")
        await ws_manager.send_json(websocket=ws,
                data=jsonable_encoder({"type":"workspace:info","data":workspace})
        )

        sandbox_id = workspace.sandbox_id
        workspace.source_path = str(config.workspace_base/workspace_id)
        workspace.target_path
        workspace_root = config.workspace_base/workspace_id
        workspace_root.mkdir(parents=True, exist_ok=True)
        await workspace_repo.save(workspace)

        if not sandbox_id:
            sandbox = sandbox_repo.run_sandbox(workspace_id)
            if not isinstance(sandbox,SandboxRunResult):
                raise WebSocketException(
                code=1002,
                reason=f"Something wrong with Docker {sandbox}"
                )  
            workspace.sandbox_id = sandbox.id
            sandbox_id = sandbox.id
            await workspace_repo.save(workspace)

        sandbox_repo.is_sandbox_running(sandbox_id)



        await ws_manager.send_json(websocket=ws,
                data=jsonable_encoder({"type":"sandbox:start","data":{"sandbox_id":sandbox_id}})
        )

        async def on_event(event: AgentEvent) -> None:
            payload = event_handler(event).to_dict()
            await ws_manager.send_json(websocket=ws,data=payload)

        agent = CloudAgentCore(workspace_id,workspace.sandbox_id,user.id,on_event)
        if workspace.status == "pending":
            await agent.run(workspace.initial_prompt)
            workspace.status  = WorkspaceStatus("ready")
            await workspace_repo.save(workspace)
        if  session_id and text:
           await agent.resume(session_id) 
           
            # text = await ws.receive()    
            # print(text)

            # await ws_manager.send_json(data={"type":"agent:send","value":"[1,2]"},websocket=ws)

        # ws_manager.disconnect(ws)    
    
router.websocket("/ws")(websocket_endpoint)

