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
from src.utils.config import config
from src.schemas.sandbox_schema import SandboxRunResult
from src.ai_core.intent_agent import IntentAgent

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
            base_domain = getattr(config, "preview_base_domain", "lvh.me")

            if frontend:
                workspace.frontend_port = frontend.host_port
                workspace.preview_port = frontend.host_port
                # Format URL as wildcard subdomain: http://<workspace_id>.lvh.me:<port>
                workspace.preview_url = (
                    f"http://{workspace_id}.{base_domain}:{frontend.host_port}"
                )

            if backend:
                workspace.backend_port = backend.host_port
                workspace.backend_url = (
                    f"http://{workspace_id}-api.{base_domain}:{backend.host_port}"
                )

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
        while True:
            session_id = ws.query_params.get("session_id")
            user_query = await ws_manager.receive(ws)

            if workspace.status == "pending":
                agent_res = await agent.run(workspace.initial_prompt)

                session = await session_repo.find_by_id(agent_res.session_id)
                if not session or not session.title:
                    raise WebSocketException(code=1008, reason="Session not found")

                intent_res = await intent_agent.analyze(workspace.initial_prompt)
                session.title = intent_res.title
                await session_repo.save(session)

                workspace.status = WorkspaceStatus("ready")
                await workspace_repo.save(workspace)

            elif session_id and user_query.data:
                await agent.resume(session_id)
                await agent.run(user_query.data["query"])

            elif not session_id and user_query.data and user_query.data.get("query"):
                intent_res = await intent_agent.analyze(user_query.data["query"])
                session = await session_repo.create(
                    title=intent_res.title,
                    user_id=user.id
                )
                await agent.run(user_query.data["query"])
                await ws_manager.send_json(
                    websocket=ws,
                    data=jsonable_encoder(
                        {"type": "session:create", "data": {"session_id": session.id}}
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