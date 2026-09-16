from src.repository.session_repository import SessionRepo
from src.utils.ws_manager import ws_manager
from fastapi import APIRouter, WebSocket, WebSocketException, WebSocketDisconnect
from src.utils.ws_manager import authenticate_websocket
from src.repository.user_repository import UserRepo
from src.dependency.sandbox_dependency import SandboxRepo
from src.dependency.port_depemdency import PortRepo
from src.repository.workspace_repository import WorkspaceRepo
from src.repository.model_repository import ModelRepo
from src.repository.settings_repository import SettingsRepo
from src.repository.usage_repository import UsageRepo
from src.models.workspace_model import WorkspaceStatus
from src.utils.event_handler import event_handler
from src.utils.port_manager import PortRole
from src.utils.agent_model import (
    agent_fingerprint as compute_agent_fingerprint,
    build_agent_kwargs_from_request,
)
from pi_sdk import AgentEvent, EventType
from src.ai_core.cloud_agent import CloudAgentCore
from fastapi.encoders import jsonable_encoder
from src.utils.config import config, build_preview_url
from src.utils.workspace_utils import prepare_workspace
from src.services.workspace_git import WorkspaceGitError
from src.schemas.sandbox_schema import SandboxRunResult
from src.ai_core.intent_agent import IntentAgent
from docker.errors import APIError, ContainerError, NotFound
from starlette.websockets import WebSocketState
import asyncio
from datetime import datetime, timezone, timedelta
from src.services.workspace_github_sync import (
    host_workspace_path,
    sync_workspace_to_github,
)
from src.services.commit_message import build_commit_message

router = APIRouter()


async def websocket_endpoint(
    ws: WebSocket,
    user_repo: UserRepo,
    sandbox_repo: SandboxRepo,
    workspace_repo: WorkspaceRepo,
    session_repo: SessionRepo,
    port_manager: PortRepo,
    model_repo: ModelRepo,
    settings_repo: SettingsRepo,
    usage_repo: UsageRepo,
):
    await ws_manager.connect(ws)
    print("Websocket connection established")
    agent: CloudAgentCore | None = None

    try:
        # 1. Authenticate once upon connection
        user = await authenticate_websocket(ws, user_repo)
        if not user or not user.id:
            raise WebSocketException(code=1002,reason="Handshake fails")
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
            try:
                workspace_root = await prepare_workspace(user, workspace)
                workspace.source_path = str(workspace_root)
                await workspace_repo.save(workspace)
            except (WorkspaceGitError, Exception) as prep_err:
                await ws_manager.send_json(
                    websocket=ws,
                    data=jsonable_encoder(
                        {
                            "type": "sandbox:error",
                            "data": {
                                "title": "Workspace prepare failed",
                                "error": str(prep_err),
                                "details": "Failed to seed template or clone GitHub repo",
                            },
                        }
                    ),
                )
                raise WebSocketException(code=1011, reason=str(prep_err)) from prep_err

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

            sandbox_cfg = await settings_repo.get_sandbox_config()
            sandbox = sandbox_repo.run_sandbox(
                workspace_id,
                docker_ports,
                skip_template_seed=(
                    getattr(workspace, "workspace_origin", "template")
                    == "github_import"
                ),
                memory_limit_mb=sandbox_cfg.get("memory_limit_mb"),
                cpu_limit=sandbox_cfg.get("cpu_limit"),
                pids_limit=sandbox_cfg.get("pids_limit"),
            )
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
                try:
                    workspace_root = await prepare_workspace(user, workspace)
                    workspace.source_path = str(workspace_root)
                    await workspace_repo.save(workspace)
                except (WorkspaceGitError, Exception) as prep_err:
                    await ws_manager.send_json(
                        websocket=ws,
                        data=jsonable_encoder(
                            {
                                "type": "sandbox:error",
                                "data": {
                                    "title": "Workspace prepare failed",
                                    "error": str(prep_err),
                                    "details": "Failed to seed template or clone GitHub repo",
                                },
                            }
                        ),
                    )
                    raise WebSocketException(code=1011, reason=str(prep_err)) from prep_err

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

                sandbox_cfg = await settings_repo.get_sandbox_config()
                sandbox = sandbox_repo.run_sandbox(
                    workspace_id,
                    docker_ports,
                    skip_template_seed=(
                        getattr(workspace, "workspace_origin", "template")
                        == "github_import"
                    ),
                    memory_limit_mb=sandbox_cfg.get("memory_limit_mb"),
                    cpu_limit=sandbox_cfg.get("cpu_limit"),
                    pids_limit=sandbox_cfg.get("pids_limit"),
                )
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
        warned_soft_cap = False

        async def on_event(event: AgentEvent) -> None:
            nonlocal warned_soft_cap
            if ws.client_state != WebSocketState.CONNECTED:
                return
            try:
                payload = event_handler(event).to_dict()
                await ws_manager.send_json(websocket=ws, data=payload)

                if event.type == EventType.USAGE:
                    u_data = event.data or {}
                    p_tok = int(u_data.get("prompt_tokens") or 0)
                    c_tok = int(u_data.get("completion_tokens") or 0)
                    cached_tok = int(u_data.get("cached_tokens") or 0)
                    cost_val = float(u_data.get("estimated_cost_usd") or 0.0)

                    active_model = agent_kwargs.get("model") or config.model
                    active_provider = agent_kwargs.get("provider") or config.provider

                    if cost_val <= 0.0 and (p_tok > 0 or c_tok > 0):
                        db_model = await model_repo.find_by_model_id(active_model)
                        if db_model:
                            in_rate = getattr(db_model, "input_price_per_mtok", 0.0) or 0.0
                            out_rate = getattr(db_model, "output_price_per_mtok", 0.0) or 0.0
                            cost_val = (p_tok * in_rate / 1_000_000.0) + (c_tok * out_rate / 1_000_000.0)

                    await usage_repo.record_usage(
                        user_id=user.id,
                        model_id=active_model,
                        provider=active_provider,
                        prompt_tokens=p_tok,
                        completion_tokens=c_tok,
                        cached_tokens=cached_tok,
                        cost_usd=cost_val,
                    )

                    if not warned_soft_cap and user.role != "admin":
                        budgets = await settings_repo.get_plan_budgets()
                        if budgets.get("enabled", True):
                            user_plan = getattr(user, "plan", "free") or "free"
                            budget_cap = float(budgets.get(user_plan, 5.0))
                            soft_pct = int(budgets.get("soft_cap_percent", 80))
                            threshold = budget_cap * (soft_pct / 100.0)
                            current_spend = await usage_repo.get_user_month_spend(user.id)
                            if threshold <= current_spend < budget_cap:
                                warned_soft_cap = True
                                await ws_manager.send_json(
                                    websocket=ws,
                                    data=jsonable_encoder({
                                        "type": "agent:budget_warning",
                                        "data": {
                                            "message": f"Monthly budget notice: you have used {round(current_spend / budget_cap * 100)}% of your monthly allowance (${current_spend:.2f} / ${budget_cap:.2f}).",
                                            "current_spend": round(current_spend, 2),
                                            "budget_limit": round(budget_cap, 2),
                                            "percent_used": round(current_spend / budget_cap * 100, 1),
                                        },
                                    }),
                                )
            except Exception as e:
                print(f"[chat_ws] on_event usage tracking error: {e}")

        # Default agent from admin settings or env/config. Recreate later only when
        # model / reasoning_effort / settings resolve to a different fingerprint.
        agent_kwargs = await build_agent_kwargs_from_request(
            model_repo,
            settings_repo=settings_repo,
            model_key=None,
            effort=None,
        )
        agent_kwargs["workspace_origin"] = (
            getattr(workspace, "workspace_origin", "template") or "template"
        )
        current_fingerprint = compute_agent_fingerprint(agent_kwargs)
        agent = CloudAgentCore(
            workspace_id, workspace.sandbox_id, user.id, on_event, **agent_kwargs
        )

        # 3. Message processing loop
        active_session_id = ws.query_params.get("session_id")
        agent_task: asyncio.Task | None = None
        host_workspace = str(config.workspace_base / workspace_id)

        async def _ensure_agent_for_request(data: dict | None) -> None:
            """Recreate CloudAgentCore only when model, effort, or settings change."""
            nonlocal agent, agent_kwargs, current_fingerprint

            payload = data or {}
            requested_model = payload.get("model") or None
            requested_effort = (
                payload.get("reasoning_effort") or payload.get("effort") or None
            )

            next_kwargs = await build_agent_kwargs_from_request(
                model_repo,
                settings_repo=settings_repo,
                model_key=requested_model,
                effort=requested_effort,
            )
            # If only effort was sent without a model, retain current model settings
            if not requested_model and requested_effort:
                next_kwargs = {**agent_kwargs, **next_kwargs, "reasoning_effort": requested_effort}

            # Keep workspace prompt mode stable across model recreations.
            next_kwargs["workspace_origin"] = agent_kwargs.get(
                "workspace_origin",
                getattr(workspace, "workspace_origin", "template") or "template",
            )

            next_fp = compute_agent_fingerprint(next_kwargs)
            if next_fp == current_fingerprint:
                return

            print(
                f"[chat_ws] recreating agent: {current_fingerprint} -> {next_fp}"
            )
            agent = CloudAgentCore(
                workspace_id,
                workspace.sandbox_id,
                user.id,
                on_event,
                **next_kwargs,
            )
            agent_kwargs = next_kwargs
            current_fingerprint = next_fp
            # Session re-bind happens in handle_run (resume / new_session).

        async def _ensure_session_host_cwd(session_id: str) -> bool:
            """Fix legacy API stubs that stored workspace='/app' before resume."""
            session = await session_repo.find_by_id(session_id)
            if not session:
                return False
            dirty = False
            if session.workspace != host_workspace:
                session.workspace = host_workspace
                dirty = True
            if session.workspace_id != workspace_id:
                session.workspace_id = workspace_id
                dirty = True
            if dirty:
                await session_repo.save(session)
            return True

        def _messages_are_fresh(messages) -> bool:
            for m in messages or []:
                role = getattr(m, "role", None)
                role_val = getattr(role, "value", role)
                if str(role_val).lower() != "system":
                    return False
            return True

        async def _title_session(session_id: str, prompt: str) -> None:
            session = await session_repo.find_by_id(session_id)
            if not session:
                return
            if session.title and session.title not in ("", "New session"):
                return
            try:
                intent_res = await intent_agent.analyze(prompt)
                session.title = intent_res.title
                await session_repo.save(session)
            except Exception as e:
                print(f"[chat_ws] intent title failed: {e}")

        async def _emit_session_create(session_id: str) -> None:
            await ws_manager.send_json(
                websocket=ws,
                data=jsonable_encoder(
                    {
                        "type": "session:create",
                        "data": {"session_id": session_id},
                    }
                ),
            )

        async def _check_budget() -> tuple[bool, str | None, dict | None]:
            if user.role == "admin":
                return True, None, None

            budgets = await settings_repo.get_plan_budgets()
            if not budgets.get("enabled", True):
                return True, None, None

            user_plan = getattr(user, "plan", "free") or "free"
            budget_cap = float(budgets.get(user_plan, 5.0))
            current_spend = await usage_repo.get_user_month_spend(user.id)

            if current_spend >= budget_cap:
                now = datetime.now(timezone.utc)
                next_month = (now.replace(day=28) + timedelta(days=4)).replace(day=1)
                reset_date = next_month.strftime("%B 1, %Y")
                detail = {
                    "current_spend": round(current_spend, 2),
                    "budget_limit": round(budget_cap, 2),
                    "plan": user_plan,
                    "resets_at": reset_date,
                    "message": f"Monthly budget limit reached (${current_spend:.2f} / ${budget_cap:.2f}). Resets on {reset_date} or contact admin to upgrade your plan.",
                }
                return False, detail["message"], detail

            return True, None, None

        async def handle_run(user_query):
            nonlocal active_session_id
            nonlocal workspace

            await _ensure_agent_for_request(
                user_query.data if user_query.data else None
            )

            query_text = (
                (user_query.data.get("query") if user_query.data else "") or ""
            ).strip()

            # Prefer message session_id — WS singleton is workspace-scoped only.
            # Do NOT steal find_by_workspace: that blocks true fresh sessions.
            req_session_id = (
                user_query.data.get("session_id") if user_query.data else None
            ) or None

            fresh_workspace = await workspace_repo.find_by_id(workspace_id)
            if fresh_workspace:
                workspace = fresh_workspace
            if not workspace:
                return

            # Pre-flight monthly budget check
            budget_ok, budget_err, budget_meta = await _check_budget()
            if not budget_ok:
                await ws_manager.send_json(
                    websocket=ws,
                    data=jsonable_encoder({
                        "type": "agent:budget_exceeded",
                        "data": budget_meta,
                    }),
                )
                await ws_manager.send_json(
                    websocket=ws,
                    data=jsonable_encoder({
                        "type": "error",
                        "data": budget_err,
                    }),
                )
                workspace.status = WorkspaceStatus.READY
                await workspace_repo.save(workspace)
                return
            # PENDING WORKSPACE — first-ever agent turn
            if workspace.status == WorkspaceStatus.PENDING and not active_session_id:
                workspace.status = WorkspaceStatus.RUNNING
                await workspace_repo.save(workspace)

                try:
                    if not agent:
                        raise WebSocketException(code=1002,reason="Agent not initilized")
                    session = await agent.new_session("New session")
                    active_session_id = session.id
                    await _emit_session_create(active_session_id)

                    run_result = await agent.run(workspace.initial_prompt)
                    await _title_session(
                        active_session_id, workspace.initial_prompt
                    )

                    workspace.status = WorkspaceStatus.READY
                    await workspace_repo.save(workspace)
                    await _persist_to_github(
                        reason="initial",
                        user_query=workspace.initial_prompt,
                        agent_summary=getattr(run_result, "text", "") or "",
                    )

                finally:
                    workspace.status = WorkspaceStatus.READY
                    await workspace_repo.save(workspace)

            # EXISTING SESSION (resume) — has a concrete session_id from the client
            elif req_session_id and query_text:
                active_session_id = req_session_id

                if not await _ensure_session_host_cwd(active_session_id):
                    await ws_manager.send_json(
                        websocket=ws,
                        data=jsonable_encoder(
                            {
                                "type": "error",
                                "data": f"Session not found: {active_session_id}",
                            }
                        ),
                    )   
                    return

                await agent.resume(active_session_id)
                is_fresh = _messages_are_fresh(agent.get_messages())
                run_result = await agent.run(query_text)
                if is_fresh:
                    await _title_session(active_session_id, query_text)
                await _persist_to_github(
                    reason="turn",
                    user_query=query_text,
                    agent_summary=getattr(run_result, "text", "") or "",
                )

            # FRESH SESSION — sidebar "New Session" / first message without id
            # Uses pi_sdk Agent.new_session() so the reused CloudAgent drops the
            # previous session and creates one with the correct host workspace.
            elif not req_session_id and query_text:
                session = await agent.new_session("New session")
                active_session_id = session.id
                await _emit_session_create(active_session_id)

                run_result = await agent.run(query_text)
                await _title_session(active_session_id, query_text)

                workspace.status = WorkspaceStatus.READY
                await workspace_repo.save(workspace)
                await _persist_to_github(
                    reason="new_session",
                    user_query=query_text,
                    agent_summary=getattr(run_result, "text", "") or "",
                )

        async def run_agent_task(user_query) -> None:
            try:
                await handle_run(user_query)
            except Exception as e:
                print(f"[chat_ws] agent task failed: {e}")
                try:
                    await ws_manager.send_json(
                        websocket=ws,
                        data=jsonable_encoder(
                            {"type": "error", "data": str(e)}
                        ),
                    )
                except Exception:
                    pass

        async def _persist_to_github(
            *,
            reason: str,
            user_query: str = "",
            agent_summary: str = "",
        ) -> None:
            nonlocal workspace
            # Skip if nothing can auth
            has_user = bool(user.github_access_token_enc)
            has_platform = bool(config.GITHUB_DEFAULT_TOKEN)
            if not has_user and not has_platform:
                return

            try:
                await ws_manager.send_json(
                    websocket=ws,
                    data=jsonable_encoder({
                        "type": "github:sync",
                        "data": {"status": "started", "reason": reason},
                    }),
                )
            except Exception:
                pass

            try:
                host_path = host_workspace_path(workspace)
            except Exception:
                host_path = config.workspace_base / workspace_id

            commit_message = await build_commit_message(
                host_path=host_path,
                user_query=user_query,
                agent_summary=agent_summary,
                intent_agent=intent_agent,
            )

            fresh_workspace, result = await sync_workspace_to_github(
                user,
                workspace,
                workspace_repo,
                message=commit_message,
            )
            if fresh_workspace:
                workspace = fresh_workspace

            payload = {
                "status": "ok" if result.ok else "error",
                "reason": reason,
                "committed": result.committed,
                "commit_message": commit_message,
                "auth_source": result.auth_source,
                "repo": result.repo_full_name,
                "error": result.error,
                "error_code": result.error_code,
            }
            try:
                await ws_manager.send_json(
                    websocket=ws,
                    data=jsonable_encoder({"type": "github:sync", "data": payload}),
                )
                if result.ok:
                    await ws_manager.send_json(
                        websocket=ws,
                        data=jsonable_encoder({"type": "workspace:info", "data": workspace}),
                    )
            except Exception:
                pass

        while True:
           user_query = await ws_manager.receive(ws)

           if user_query.type == "agent:abort":
               agent.abort()
               continue
           
           if agent_task and not agent_task.done():
               await ws_manager.send_json(
                   websocket=ws,
                   data={
                       "type": "agent:busy"
                   }
               )
               continue
           
           agent_task = asyncio.create_task(run_agent_task(user_query))
        
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