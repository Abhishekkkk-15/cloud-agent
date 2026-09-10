from src.repository.session_repository import SessionRepo
from src.utils.ws_manager import ws_manager
from fastapi import APIRouter, WebSocket, WebSocketException, WebSocketDisconnect
from src.utils.ws_manager import authenticate_websocket
from src.repository.user_repository import UserRepo
from src.dependency.sandbox_dependency import SandboxRepo
from src.dependency.port_depemdency import PortRepo
from src.repository.workspace_repository import WorkspaceRepo
from src.models.workspace_model import WorkspaceStatus
from src.utils.event_handler import event_handler
from src.utils.port_manager import PortRole
from pi_sdk import AgentEvent
from src.ai_core.cloud_agent import CloudAgentCore
from fastapi.encoders import jsonable_encoder
from src.utils.config import config, build_preview_url
from src.schemas.sandbox_schema import SandboxRunResult
from src.ai_core.intent_agent import IntentAgent
from docker.errors import APIError, ContainerError, NotFound

router = APIRouter()


async def websocket_endpoint(
    ws: WebSocket,
    user_repo: UserRepo,
    sandbox_repo: SandboxRepo,
    workspace_repo: WorkspaceRepo,
    session_repo: SessionRepo,
    port_manager: PortRepo,
):
    await ws_manager.connect(ws)
    print("Websocket connection established")

    try:
        # 1. Authenticate once upon connection
        user = await authenticate_websocket(ws, user_repo)
        workspace_id = ws.query_params.get("workspace_id")

        if not workspace_id:
            raise WebSocketException(code=1008, reason="workspace is required")

        workspace = await workspace_repo.find_by_id(workspace_id)
        if not workspace:
            raise WebSocketException(code=4004, reason="workspace not found")

        await ws_manager.send_json(
            websocket=ws,
            data=jsonable_encoder({"type": "workspace:info", "data": workspace}),
        )

        # 2. Check or provision Docker sandbox
        sandbox_id = workspace.sandbox_id

        if not sandbox_id:
            print("Starting sandbox container...")
            workspace.source_path = str(config.workspace_base / workspace_id)
            workspace_root = config.workspace_base / workspace_id
            workspace_root.mkdir(parents=True, exist_ok=True)

            # Allocate host ports for container (e.g., 5173 -> host_port)
            allocated = port_manager.allocate_workspace_ports(workspace_id)
            docker_ports = port_manager.to_docker_ports(workspace_id)
            
            sandbox = sandbox_repo.run_sandbox(workspace_id, docker_ports)
            if not isinstance(sandbox, SandboxRunResult):
                port_manager.release_workspace_ports(workspace_id)
                raise WebSocketException(
                    code=1002,
                    reason=f"Failed starting Docker sandbox: {sandbox}",
                )

            frontend = next(
                (p for p in allocated if p.role == PortRole.FRONTEND), None
            )
            backend = next(
                (p for p in allocated if p.role == PortRole.BACKEND), None
            )

            # Define base preview domain (defaulting to lvh.me for local dev)
            if frontend:
                workspace.frontend_port = frontend.host_port
                workspace.preview_port = frontend.host_port
                # Format URL as central proxy: http://<workspace_id>.lvh.me:8000
                workspace.preview_url = build_preview_url(workspace_id, is_backend=False)

            if backend:
                workspace.backend_port = backend.host_port
                workspace.backend_url = build_preview_url(workspace_id, is_backend=True)

            workspace.preview_status = "ports_ready"
            workspace.sandbox_id = sandbox.id
            sandbox_id = sandbox.id

            await workspace_repo.save(workspace)

        # Checking if sandbox/Docker container exists and if its running
        
        is_sandbox_running = sandbox_repo.is_sandbox_running(sandbox_id)
        if not is_sandbox_running:
            try:
                resumed_sandbox = sandbox_repo.resume_sandbox(sandbox_id)
                if not isinstance(resumed_sandbox, SandboxRunResult):
                    port_manager.release_workspace_ports(workspace_id)
                    raise WebSocketException(
                    code=1002,
                    reason=f"Failed starting Docker sandbox: {resumed_sandbox}",
                    )
            except NotFound:    
                print("Starting sandbox container...")
                workspace.source_path = str(config.workspace_base / workspace_id)
                workspace_root = config.workspace_base / workspace_id
                workspace_root.mkdir(parents=True, exist_ok=True)
    
                # Allocate host ports for container (e.g., 5173 -> host_port)
                allocated = port_manager.allocate_workspace_ports(workspace_id)
                docker_ports = port_manager.to_docker_ports(workspace_id)
                
                sandbox = sandbox_repo.run_sandbox(workspace_id, docker_ports)
                if not isinstance(sandbox, SandboxRunResult):
                    port_manager.release_workspace_ports(workspace_id)
                    raise WebSocketException(
                        code=1002,
                        reason=f"Failed starting Docker sandbox: {sandbox}",
                    )
    
                frontend = next(
                    (p for p in allocated if p.role == PortRole.FRONTEND), None
                )
                backend = next(
                    (p for p in allocated if p.role == PortRole.BACKEND), None
                )
    
                if frontend:
                    workspace.frontend_port = frontend.host_port
                    workspace.preview_port = frontend.host_port
                    # Format URL as central proxy: http://<workspace_id>.lvh.me:8000
                    workspace.preview_url = build_preview_url(workspace_id, is_backend=False)

                if backend:
                    workspace.backend_port = backend.host_port
                    workspace.backend_url = build_preview_url(workspace_id, is_backend=True)
    
                workspace.preview_status = "ports_ready"
                workspace.sandbox_id = sandbox.id
                sandbox_id = sandbox.id
    
                await workspace_repo.save(workspace)    
            
                

        # Notify client of active sandbox and ready wildcard URLs
        await ws_manager.send_json(
            websocket=ws,
            data=jsonable_encoder(
                {
                    "type": "sandbox:start",
                    "data": {
                        "sandbox_id": sandbox_id,
                        "frontend_port": workspace.frontend_port,
                        "backend_port": workspace.backend_port,
                        "preview_url": workspace.preview_url,
                        "backend_url": workspace.backend_url,
                    },
                }
            ),
        )

        intent_agent = IntentAgent()

        async def on_event(event: AgentEvent) -> None:
            payload = event_handler(event).to_dict()
            await ws_manager.send_json(websocket=ws, data=payload)

        agent = CloudAgentCore(
            workspace_id, workspace.sandbox_id, user.id, on_event
        )

        # 3. Message processing loop
        active_session_id = ws.query_params.get("session_id")
        while True:
            user_query = await ws_manager.receive(ws)
            query_text = user_query.data.get("query") if user_query.data else ""
            req_session_id = (
                (user_query.data.get("session_id") if user_query.data else None)
                or ws.query_params.get("session_id")
                or active_session_id
            )

            if workspace.status == "pending":
                agent_res = await agent.run(workspace.initial_prompt)
                active_session_id = agent_res.session_id

                session = await session_repo.find_by_id(agent_res.session_id)
                if session:
                    intent_res = await intent_agent.analyze(workspace.initial_prompt)
                    session.title = intent_res.title
                    await session_repo.save(session)

                workspace.status = WorkspaceStatus("ready")
                await workspace_repo.save(workspace)

                await ws_manager.send_json(
                    websocket=ws,
                    data=jsonable_encoder(
                        {"type": "session:create", "data": {"session_id": active_session_id}}
                    ),
                )

            elif req_session_id and query_text:
                active_session_id = req_session_id
                await agent.resume(active_session_id)
                await agent.run(query_text)

            elif not req_session_id and query_text:
                agent_res = await agent.run(query_text)
                active_session_id = agent_res.session_id

                intent_res = await intent_agent.analyze(query_text)
                session = await session_repo.find_by_id(active_session_id)
                if session:
                    session.title = intent_res.title
                    await session_repo.save(session)

                await ws_manager.send_json(
                    websocket=ws,
                    data=jsonable_encoder(
                        {"type": "session:create", "data": {"session_id": active_session_id}}
                    ),
                )

    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
    except Exception as e:
        print(f"[WebSocket Error]: {e}")
        await ws_manager.send_json(
            websocket=ws, data=jsonable_encoder({"type": "error", "data": str(e)})
        )


router.websocket("/ws")(websocket_endpoint)