from typing import Any
import asyncio
import logging
from bson import ObjectId
import httpx
import websockets
from starlette.types import ASGIApp, Receive, Scope, Send

from src.dependency.port_depemdency import get_portmanager
from src.utils.config import config
from src.utils.port_manager import PortRole
import src.utils.db_client as db_module

logger = logging.getLogger(__name__)

_HTTPX_CLIENT: httpx.AsyncClient | None = None


def get_httpx_client() -> httpx.AsyncClient:
    global _HTTPX_CLIENT
    if _HTTPX_CLIENT is None or _HTTPX_CLIENT.is_closed:
        _HTTPX_CLIENT = httpx.AsyncClient(
            timeout=httpx.Timeout(60.0, connect=10.0),
            limits=httpx.Limits(max_keepalive_connections=100, max_connections=500),
            follow_redirects=False,
        )
    return _HTTPX_CLIENT


class SubdomainProxyMiddleware:
    """ASGI middleware that intercepts wildcard workspace subdomains and proxies traffic.

    Examples:
      - <workspace_id>.lvh.me:8000       -> proxies to workspace frontend port (4000)
      - <workspace_id>-api.lvh.me:8000   -> proxies to workspace backend port (3000)
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        # Extract Host header
        headers = dict(scope.get("headers", []))
        host_header = headers.get(b"host", b"").decode("latin1").lower()
        hostname = host_header.split(":")[0].strip()

        base_domain = getattr(config, "preview_base_domain", "lvh.me").lower().strip()

        # Check if the hostname has a subdomain before the base domain
        if not hostname.endswith(f".{base_domain}"):
            await self.app(scope, receive, send)
            return

        subdomain = hostname[: -len(f".{base_domain}")].strip(".")
        if not subdomain or subdomain in ("api", "www", "app", "admin"):
            await self.app(scope, receive, send)
            return

        is_backend = False
        workspace_id = subdomain
        if subdomain.endswith("-api"):
            is_backend = True
            workspace_id = subdomain[:-4]

        # Resolve target port for the workspace
        target_port = await self._resolve_target_port(workspace_id, is_backend)
        if not target_port:
            if scope["type"] == "http":
                await self._send_not_found(
                    send,
                    f"Workspace '{workspace_id}' runtime not found or ports not ready.",
                )
            elif scope["type"] == "websocket":
                await send({"type": "websocket.close", "code": 1008})
            return

        if scope["type"] == "http":
            await self._proxy_http(scope, receive, send, target_port)
        elif scope["type"] == "websocket":
            await self._proxy_websocket(scope, receive, send, target_port)

    async def _resolve_target_port(
        self, workspace_id: str, is_backend: bool
    ) -> int | None:
        port_manager = get_portmanager()
        role = PortRole.BACKEND if is_backend else PortRole.FRONTEND

        # 1. Fast in-memory lookup
        port_obj = port_manager.get_workspace_port(workspace_id, role)
        if port_obj and port_obj.host_port:
            return port_obj.host_port

        # 2. Database lookup fallback
        try:
            if db_module.db_client is not None and ObjectId.is_valid(workspace_id):
                doc = await db_module.db_client["workspaces"].find_one(
                    {"_id": ObjectId(workspace_id)}
                )
                if doc:
                    if is_backend:
                        return doc.get("backend_port")
                    return doc.get("frontend_port") or doc.get("preview_port")
        except Exception as e:
            logger.error(f"[Proxy] DB lookup failed for {workspace_id}: {e}")

        return None

    async def _proxy_http(
        self, scope: Scope, receive: Receive, send: Send, target_port: int
    ) -> None:
        path = scope.get("path", "/")
        query_string = scope.get("query_string", b"").decode("latin1")
        target_url = f"http://127.0.0.1:{target_port}{path}"
        if query_string:
            target_url += f"?{query_string}"

        # Collect incoming request body
        body = b""
        more_body = True
        while more_body:
            msg = await receive()
            body += msg.get("body", b"")
            more_body = msg.get("more_body", False)

        # Forward headers with hop-by-hop headers removed
        excluded_headers = {
            b"host",
            b"connection",
            b"transfer-encoding",
            b"content-length",
            b"keep-alive",
        }
        forward_headers = [
            (k.decode("latin1"), v.decode("latin1"))
            for k, v in scope.get("headers", [])
            if k.lower() not in excluded_headers
        ]
        forward_headers.append(("host", f"127.0.0.1:{target_port}"))
        client_ip = scope.get("client", ("127.0.0.1", 0))[0]
        forward_headers.append(("x-forwarded-for", client_ip))
        forward_headers.append(("x-forwarded-proto", scope.get("scheme", "http")))

        client = get_httpx_client()
        try:
            response = await client.request(
                method=scope["method"],
                url=target_url,
                headers=forward_headers,
                content=body,
            )
        except Exception as exc:
            logger.error(f"[Proxy HTTP Error] {target_url}: {exc}")
            await self._send_bad_gateway(
                send, f"Could not reach sandbox service on port {target_port}: {exc}"
            )
            return

        # Prepare filtered response headers
        excluded_resp_headers = {
            b"content-encoding",
            b"transfer-encoding",
            b"connection",
            b"keep-alive",
        }
        resp_headers = [
            (k, v)
            for k, v in response.headers.raw
            if k.lower() not in excluded_resp_headers
        ]

        await send(
            {
                "type": "http.response.start",
                "status": response.status_code,
                "headers": resp_headers,
            }
        )
        await send(
            {
                "type": "http.response.body",
                "body": response.content,
                "more_body": False,
            }
        )

    async def _proxy_websocket(
        self, scope: Scope, receive: Receive, send: Send, target_port: int
    ) -> None:
        path = scope.get("path", "/")
        query_string = scope.get("query_string", b"").decode("latin1")
        target_ws_url = f"ws://127.0.0.1:{target_port}{path}"
        if query_string:
            target_ws_url += f"?{query_string}"

        # Extract subprotocols requested by the client (e.g. ['vite-hmr'])
        subprotocols: list[str] = list(scope.get("subprotocols", []))
        if not subprotocols:
            headers = dict(scope.get("headers", []))
            raw_subprotocol = headers.get(b"sec-websocket-protocol", b"").decode("latin1")
            if raw_subprotocol:
                subprotocols = [s.strip() for s in raw_subprotocol.split(",") if s.strip()]

        client_closed = False

        async def safe_send(msg: dict[str, Any]) -> None:
            nonlocal client_closed
            if client_closed:
                return
            try:
                await send(msg)
                if msg.get("type") == "websocket.close":
                    client_closed = True
            except Exception:
                client_closed = True

        connect_kwargs: dict[str, Any] = {}
        if subprotocols:
            connect_kwargs["subprotocols"] = subprotocols

        try:
            async with websockets.connect(target_ws_url, **connect_kwargs) as server_ws:
                # Accept client connection with negotiated subprotocol (RFC 6455 requires echoing matched subprotocol)
                accept_msg: dict[str, Any] = {"type": "websocket.accept"}
                server_subprotocol = getattr(server_ws, "subprotocol", None)
                if server_subprotocol:
                    accept_msg["subprotocol"] = str(server_subprotocol)
                elif subprotocols:
                    accept_msg["subprotocol"] = subprotocols[0]
                await safe_send(accept_msg)

                async def client_to_server() -> None:
                    nonlocal client_closed
                    try:
                        while not client_closed:
                            msg = await receive()
                            if msg["type"] == "websocket.receive":
                                if "text" in msg:
                                    await server_ws.send(msg["text"])
                                elif "bytes" in msg:
                                    await server_ws.send(msg["bytes"])
                            elif msg["type"] == "websocket.disconnect":
                                client_closed = True
                                break
                    except Exception:
                        pass
                    finally:
                        try:
                            await server_ws.close()
                        except Exception:
                            pass

                async def server_to_client() -> None:
                    try:
                        async for msg in server_ws:
                            if isinstance(msg, str):
                                await safe_send({"type": "websocket.send", "text": msg})
                            elif isinstance(msg, bytes):
                                await safe_send({"type": "websocket.send", "bytes": msg})
                    except Exception:
                        pass
                    finally:
                        await safe_send({"type": "websocket.close", "code": 1000})

                await asyncio.gather(
                    client_to_server(), server_to_client(), return_exceptions=True
                )
        except Exception as exc:
            logger.error(f"[Proxy WebSocket Error] {target_ws_url}: {exc}")
            await safe_send({"type": "websocket.close", "code": 1011})

    async def _send_not_found(self, send: Send, message: str) -> None:
        content = message.encode("utf-8")
        headers = [
            (b"content-type", b"text/plain; charset=utf-8"),
            (b"content-length", str(len(content)).encode("latin1")),
        ]
        await send({"type": "http.response.start", "status": 404, "headers": headers})
        await send(
            {"type": "http.response.body", "body": content, "more_body": False}
        )

    async def _send_bad_gateway(self, send: Send, message: str) -> None:
        content = message.encode("utf-8")
        headers = [
            (b"content-type", b"text/plain; charset=utf-8"),
            (b"content-length", str(len(content)).encode("latin1")),
        ]
        await send({"type": "http.response.start", "status": 502, "headers": headers})
        await send(
            {"type": "http.response.body", "body": content, "more_body": False}
        )
