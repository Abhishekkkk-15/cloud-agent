from src.repository.session_repository import SessionRepo
from src.utils.ws_manager import ws_manager
from fastapi import APIRouter, WebSocket, WebSocketException, WebSocketDisconnect
from src.utils.ws_manager import authenticate_websocket
from src.repository.user_repository import UserRepo
from src.dependency.sandbox_dependency import SandboxRepo
from src.dependency.port_depemdency import PortRepo
from src.repository.workspace_repository import WorkspaceRepo
from src.repository.model_repository import ModelRepo
from src.models.workspace_model import WorkspaceStatus
from src.utils.event_handler import event_handler
from src.utils.port_manager import PortRole
from pi_sdk import AgentEvent
from src.ai_core.cloud_agent import CloudAgentCore
from fastapi.encoders import jsonable_encoder
from src.utils.config import config, build_preview_url
from src.utils.workspace_utils import ensure_workspace_template
from src.schemas.sandbox_schema import SandboxRunResult
from src.ai_core.intent_agent import IntentAgent
from docker.errors import APIError, ContainerError, NotFound
from starlette.websockets import WebSocketState

router = APIRouter()


async def websocket_endpoint(
    ws: WebSocket,
    user_repo: UserRepo,
    sandbox_repo: SandboxRepo,
    workspace_repo: WorkspaceRepo,
    session_repo: SessionRepo,
    port_manager: PortRepo,
    model_repo: ModelRepo,
):
    await ws_manager.connect(ws)
    print("Websocket connection established")
    agent: CloudAgentCore | None = None

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
            await ws_manager.send_json(
                websocket=ws,
                data=jsonable_encoder(
                    {
                        "type": "sandbox:starting",
                        "data": {
                            "title": "Starting Docker Sandbox",
                            "message": "Initializing container and mounting workspace volume...",
                            "stage": "container",
                        },
                    }
                ),
            )

            workspace.source_path = str(config.workspace_base / workspace_id)
            workspace_root = ensure_workspace_template(workspace_id)

            # Allocate host ports for container (e.g., 5173 -> host_port)
            allocated = port_manager.allocate_workspace_ports(workspace_id)
            docker_ports = port_manager.to_docker_ports(workspace_id)

            await ws_manager.send_json(
                websocket=ws,
                data=jsonable_encoder(
                    {
                        "type": "sandbox:status",
                        "data": {
                            "title": "Configuring Networking",
                            "message": "Setting up networking for your preview...",
                            "stage": "network",
                        },
                    }
                ),
            )

            sandbox = sandbox_repo.run_sandbox(workspace_id, docker_ports)
            if not isinstance(sandbox, SandboxRunResult):
                port_manager.release_workspace_ports(workspace_id)
                await ws_manager.send_json(
                    websocket=ws,
                    data=jsonable_encoder(
                        {
                            "type": "sandbox:error",
                            "data": {
                                "title": "Docker Sandbox Error",
                                "error": str(sandbox),
                                "details": "Failed starting Docker sandbox container",
                            },
                        }
                    ),
                )
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
            await ws_manager.send_json(
                websocket=ws,
                data=jsonable_encoder(
                    {
                        "type": "sandbox:resuming",
                        "data": {
                            "title": "Resuming Sandbox",
                            "message": "Resuming existing Docker container...",
                            "stage": "container",
                        },
                    }
                ),
            )
            try:
                resumed_sandbox = sandbox_repo.resume_sandbox(sandbox_id)
                if not isinstance(resumed_sandbox, SandboxRunResult):
                    port_manager.release_workspace_ports(workspace_id)
                    await ws_manager.send_json(
                        websocket=ws,
                        data=jsonable_encoder(
                            {
                                "type": "sandbox:error",
                                "data": {
                                    "title": "Failed to Resume Sandbox",
                                    "error": str(resumed_sandbox),
                                    "details": "Could not resume paused container",
                                },
                            }
                        ),
                    )
                    raise WebSocketException(
                        code=1002,
                        reason=f"Failed starting Docker sandbox: {resumed_sandbox}",
                    )
            except NotFound:
                print("Starting sandbox container...")
                await ws_manager.send_json(
                    websocket=ws,
                    data=jsonable_encoder(
                        {
                            "type": "sandbox:starting",
                            "data": {
                                "title": "Recreating Sandbox Container",
                                "message": "Previous container not found; provisioning fresh container...",
                                "stage": "container",
                            },
                        }
                    ),
                )
                workspace.source_path = str(config.workspace_base / workspace_id)
                workspace_root = ensure_workspace_template(workspace_id)

                # Allocate host ports for container (e.g., 5173 -> host_port)
                allocated = port_manager.allocate_workspace_ports(workspace_id)
                docker_ports = port_manager.to_docker_ports(workspace_id)

                await ws_manager.send_json(
                    websocket=ws,
                    data=jsonable_encoder(
                        {
                            "type": "sandbox:status",
                            "data": {
                                "title": "Configuring Networking",
                                "message": "Setting up networking for your preview...",
                                "stage": "network",
                            },
                        }
                    ),
                )

                sandbox = sandbox_repo.run_sandbox(workspace_id, docker_ports)
                if not isinstance(sandbox, SandboxRunResult):
                    port_manager.release_workspace_ports(workspace_id)
                    await ws_manager.send_json(
                        websocket=ws,
                        data=jsonable_encoder(
                            {
                                "type": "sandbox:error",
                                "data": {
                                    "title": "Docker Sandbox Error",
                                    "error": str(sandbox),
                                    "details": "Failed recreating Docker container",
                                },
                            }
                        ),
                    )
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
                        "title": "Sandbox Ready",
                        "message": "Development environment and preview online",
                        "stage": "ready",
                    },
                }
            ),
        )

        intent_agent = IntentAgent()

        async def on_event(event: AgentEvent) -> None:
            if ws.client_state != WebSocketState.CONNECTED:
                return
            try:
                payload = event_handler(event).to_dict()
                await ws_manager.send_json(websocket=ws, data=payload)
            except Exception:
                pass

        # Resolve requested model and reasoning effort from query params
        requested_model_id = ws.query_params.get("model")
        requested_effort = ws.query_params.get("reasoning_effort") or ws.query_params.get("effort")

        target_model = None
        if requested_model_id and requested_model_id != "auto":
            target_model = await model_repo.find_by_id(requested_model_id)
        elif requested_model_id == "auto":
            target_model = await model_repo.find_default()

        agent_kwargs = {}
        if target_model:
            agent_kwargs["model"] = target_model.model_id
            agent_kwargs["provider"] = target_model.provider
            if target_model.url or target_model.base_url:
                agent_kwargs["base_url"] = target_model.url or target_model.base_url
            if target_model.api_key:
                agent_kwargs["api_key"] = target_model.api_key
            if requested_effort:
                agent_kwargs["reasoning_effort"] = requested_effort
            elif target_model.supports_effort and target_model.default_effort:
                agent_kwargs["reasoning_effort"] = target_model.default_effort

        agent = CloudAgentCore(
            workspace_id, workspace.sandbox_id, user.id, on_event, **agent_kwargs
        )

        # 3. Message processing loop
        active_session_id = ws.query_params.get("session_id")
        while True:
            try:
                user_query = await ws_manager.receive(ws)
            except (WebSocketDisconnect, RuntimeError):
                agent.abort()
                break
            is_abort = user_query.type == "agent:abort"                
            if is_abort:
                 agent.abort()
                 break
            query_text = user_query.data.get("query") if user_query.data else ""
            req_session_id = (
                (user_query.data.get("session_id") if user_query.data else None)
                or ws.query_params.get("session_id")
                or active_session_id
            )

            # If no session_id in query or params, check if workspace already has an existing session in DB
            if not req_session_id:
                existing_session = await session_repo.find_by_workspace(workspace_id)
                if existing_session:
                    req_session_id = existing_session.id
                    active_session_id = existing_session.id

            # Re-fetch workspace in case status was updated
            fresh_workspace = await workspace_repo.find_by_id(workspace_id)
            if fresh_workspace:
                workspace = fresh_workspace

            if workspace.status == WorkspaceStatus.PENDING and not active_session_id:
                workspace.status = WorkspaceStatus.RUNNING
                await workspace_repo.save(workspace)

                try:
                    agent_res = await agent.run(workspace.initial_prompt)
                    active_session_id = agent_res.session_id

                    session = await session_repo.find_by_id(agent_res.session_id)
                    if session:
                        intent_res = await intent_agent.analyze(workspace.initial_prompt)
                        session.title = intent_res.title
                        await session_repo.save(session)

                    workspace.status = WorkspaceStatus.READY
                    await workspace_repo.save(workspace)

                    await ws_manager.send_json(
                        websocket=ws,
                        data=jsonable_encoder(
                            {"type": "session:create", "data": {"session_id": active_session_id}}
                        ),
                    )
                except Exception as err:
                    workspace.status = WorkspaceStatus.READY
                    await workspace_repo.save(workspace)
                    raise err

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

                workspace.status = WorkspaceStatus.READY
                await workspace_repo.save(workspace)

                await ws_manager.send_json(
                    websocket=ws,
                    data=jsonable_encoder(
                        {"type": "session:create", "data": {"session_id": active_session_id}}
                    ),
                )

    except WebSocketDisconnect:
        if agent:
            agent.abort()
        ws_manager.disconnect(ws)
    except Exception as e:
        print(f"[WebSocket Error]: {e}")
        if agent:
            agent.abort()
        try:
            if ws.client_state == WebSocketState.CONNECTED:
                await ws_manager.send_json(
                    websocket=ws, data=jsonable_encoder({"type": "error", "data": str(e)})
                )
        except Exception:
            pass
        finally:
            if agent:
                agent.abort()
            ws_manager.disconnect(ws)


router.websocket("/ws")(websocket_endpoint)