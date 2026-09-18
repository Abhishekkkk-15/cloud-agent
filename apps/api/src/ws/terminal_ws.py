from fastapi import WebSocket, WebSocketException, WebSocketDisconnect
from src.utils.ws_manager import authenticate_websocket, ws_manager
from src.repository.workspace_repository import WorkspaceRepo
from src.repository.user_repository import UserRepo
from src.dependency.sandbox_dependency import SandboxRepo
from src.models.workspace_model import Workspace
from starlette.websockets import WebSocketState
import asyncio
import json


async def terminal_ws(
    ws: WebSocket,
    user_repo: UserRepo,
    workspace_repo: WorkspaceRepo,
    sandbox_repo: SandboxRepo,
):
    await ws_manager.connect(ws)
    sock = None

    try:
        user = await authenticate_websocket(ws, user_repo)
        if not user or not user.id:
            raise WebSocketException(code=1008, reason="Authentication failed")

        workspace_id = ws.query_params.get("workspace_id")
        if not workspace_id:
            raise WebSocketException(code=1008, reason="workspace_id is required")

        workspace = await workspace_repo.find_by_id(workspace_id)
        if not workspace:
            raise WebSocketException(code=1008, reason="Workspace not found")

        sandbox_id = workspace.sandbox_id
        if not sandbox_id:
            raise WebSocketException(code=1008, reason="Sandbox does not exist")

        sandbox_running = sandbox_repo.is_sandbox_running(sandbox_id)
        if not sandbox_running:
            raise WebSocketException(code=1008, reason="Sandbox is not running")

        sandbox_client = sandbox_repo.client
        if not sandbox_client:
            raise WebSocketException(code=1008, reason="Docker is not connected")

        exec_instance = sandbox_client.api.exec_create(
            container=sandbox_id,
            cmd=["/bin/bash"],
            stdin=True,
            stdout=True,
            stderr=True,
            tty=True,
            environment={
                "TERM": "xterm-256color",
                "LANG": "C.UTF-8",
                "COLORTERM": "truecolor",
            },
            workdir="/app",
        )

        exec_id = exec_instance["Id"]

        sock = sandbox_client.api.exec_start(
            exec_id,
            detach=False,
            tty=True,
            socket=True,
        )

        stop_event = asyncio.Event()

        async def stream_output():
            try:
                while not stop_event.is_set():
                    # Read blocking socket in thread pool without blocking the asyncio loop
                    data = await asyncio.to_thread(sock.recv, 4096)
                    if not data:
                        break
                    if ws.client_state == WebSocketState.CONNECTED:
                        await ws.send_bytes(data)
            except Exception as e:
                pass
            finally:
                stop_event.set()

        async def stream_input():
            try:
                while not stop_event.is_set():
                    msg = await ws.receive()
                    if msg.get("type") == "websocket.disconnect":
                        break

                    # Binary keystrokes
                    if "bytes" in msg and msg["bytes"]:
                        await asyncio.to_thread(sock.sendall, msg["bytes"])

                    # Text keystrokes or resize
                    elif "text" in msg and msg["text"]:
                        text = msg["text"]
                        try:
                            ctrl = json.loads(text)
                            if ctrl.get("type") == "resize":
                                sandbox_client.api.exec_resize(
                                    exec_id,
                                    height=int(ctrl["rows"]),
                                    width=int(ctrl["cols"]),
                                )
                                continue
                        except (ValueError, KeyError, TypeError):
                            pass

                        await asyncio.to_thread(sock.sendall, text.encode("utf-8"))
            except Exception as e:
                pass
            finally:
                stop_event.set()

        await asyncio.gather(stream_output(), stream_input(), return_exceptions=True)

    except WebSocketDisconnect:
        pass
    except WebSocketException as we:
        try:
            if ws.client_state == WebSocketState.CONNECTED:
                await ws.close(code=we.code, reason=we.reason)
        except Exception:
            pass
    except Exception as e:
        print(f"[Terminal WS Error]: {e}")
        try:
            if ws.client_state == WebSocketState.CONNECTED:
                await ws.close(code=1011, reason=str(e))
        except Exception:
            pass
    finally:
        ws_manager.disconnect(ws)
        if sock is not None:
            try:
                sock.close()
            except Exception:
                pass
        try:
            if ws.client_state == WebSocketState.CONNECTED:
                await ws.close()
        except Exception:
            pass