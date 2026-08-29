from src.repository.session_repository import SessionRepo
from src.utils.ws_manager import ws_manager, ConnectionManager
from fastapi import APIRouter, WebSocket, WebSocketException,WebSocketDisconnect
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
from src.ai_core.intent_agent import IntentAgent

router = APIRouter()




async def websocket_endpoint(ws:WebSocket,user_repo:UserRepo,sandbox_repo:SandboxRepo,workspace_repo:WorkspaceRepo,session_repo:SessionRepo):
    
    # Recieve workspace id and session_id (if there is) from query
    # fetch workspace and session details
    # check if workspace sandbox/container is running (Event: Checking Sandbox Status)
    # if not sandbox start/create sandbox  (Event: Starting Sandbox container)
    # save container id
    # create agent with workspace_id
    
    await ws_manager.connect(ws)
    print("websocket connection setablished")
    
    while True:
        try:
            intent_agent = IntentAgent()
            user = await authenticate_websocket(ws,user_repo)
            workspace_id = ws.query_params.get("workspace_id")
            user_query = await ws_manager.receive(ws)  
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

            # await workspace_repo.save(workspace)

            if not sandbox_id:
                print("starting sandbox")
                workspace.source_path = str(config.workspace_base/workspace_id)
                workspace.target_path
                workspace_root = config.workspace_base/workspace_id
                workspace_root.mkdir(parents=True, exist_ok=True)
                sandbox = sandbox_repo.run_sandbox(workspace_id)
                if not isinstance(sandbox,SandboxRunResult):
                    raise WebSocketException(
                    code=1002,
                    reason=f"Something wrong with Docker {sandbox}"
                    )  
                workspace.sandbox_id = sandbox.id
                sandbox_id = sandbox.id

                await workspace_repo.save(workspace)


            await ws_manager.send_json(websocket=ws,
                    data=jsonable_encoder({"type":"sandbox:start","data":{"sandbox_id":sandbox_id}})
            )

            async def on_event(event: AgentEvent) -> None:
                payload = event_handler(event).to_dict()
                await ws_manager.send_json(websocket=ws,data=payload)

            agent = CloudAgentCore(workspace_id,workspace.sandbox_id,user.id,on_event)
            if workspace.status == "pending":
                agent_res = await agent.run(workspace.initial_prompt)

                session = await session_repo.find_by_id(agent_res.session_id) #type:ignore
                if not session or not session.title:
                    WebSocketException(code=1008,reason="Session not found")
                intent_res = await intent_agent.analyze(workspace.initial_prompt)
                session.title = intent_res.title
                await session_repo.save(session)
                workspace.status  = WorkspaceStatus("ready")
                await workspace_repo.save(workspace)            
            elif   session_id and user_query.data:
                print(user_query,user_query.data)
                await agent.resume(session_id) 
                await agent.run(user_query.data["query"])
            elif not session_id and user_query.data and user_query.data["query"]:
                intent_res = await intent_agent.analyze(user_query.data["query"])
                session = await session_repo.create(title=intent_res.title,user_id=user.id)
                await agent.run(user_query.data["query"])
                await ws_manager.send_json(websocket=ws,data=jsonable_encoder({"type":"session:create","data":{"session_id":session.id}}))
        except WebSocketDisconnect:
            await sandbox_repo.stop_sandbox(workspace.sandbox_id)
            await ws_manager.disconnect(ws)
            break
        except Exception as e:
            print(e)
            await ws_manager.send_json(websocket=ws,data=jsonable_encoder({"type":"error","data":str(e)}))
            break
router.websocket("/ws")(websocket_endpoint)
