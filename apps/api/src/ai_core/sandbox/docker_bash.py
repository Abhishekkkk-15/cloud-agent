"""docker_bash tool backed by the TCP Docker client (WSL), matching pi_sdk behavior."""

from __future__ import annotations

import asyncio
import threading
import time
from typing import Optional

from docker import DockerClient
from docker.errors import APIError, NotFound

from pi_sdk import ToolSpec
from pi_sdk.tools import (
    _format_bash_error,
    _resolve_docker_container,
    _resolve_docker_workdir,
    _should_run_background,
    _truncate_bash_output,
)
from src.ai_core.sandbox.client import get_sandbox_client


def _decode_chunks(chunks: list[bytes]) -> str:
    return b"".join(chunks).decode("utf-8", errors="replace")


def _read_exec_stream(api, exec_id: str, deadline: float | None) -> tuple[str, bool]:
    """
    Read exec stdout/stderr until the stream ends or deadline is reached.

    Returns (output, timed_out_before_completion).
    """
    output_chunks: list[bytes] = []
    finished = threading.Event()
    error_holder: list[BaseException] = []

    def _reader() -> None:
        try:
            for stdout, stderr in api.exec_start(exec_id, stream=True, demux=True):
                if stdout:
                    output_chunks.append(stdout)
                if stderr:
                    output_chunks.append(stderr)
        except Exception as exc:
            error_holder.append(exc)
        finally:
            finished.set()

    thread = threading.Thread(target=_reader, daemon=True)
    thread.start()

    if deadline is None:
        finished.wait()
    else:
        remaining = max(0.0, deadline - time.monotonic())
        finished.wait(timeout=remaining)

    if error_holder:
        raise error_holder[0]

    timed_out = not finished.is_set()
    return _decode_chunks(output_chunks), timed_out


def _docker_exec_blocking(
    client: DockerClient,
    container_ref: str,
    command: str,
    workdir: Optional[str],
    user: Optional[str],
    timeout: int,
    should_run_bg: bool,
) -> str:
    container = client.containers.get(container_ref)
    cmd = ["sh", "-lc", command]
    api = client.api

    exec_id = api.exec_create(
        container.id,
        cmd,
        workdir=(workdir or None),
        user=(user or None),
        stdin=False,
    )["Id"]

    wait_limit = 4 if should_run_bg else timeout

    if should_run_bg:
        output, timed_out = _read_exec_stream(
            api, exec_id, deadline=time.monotonic() + wait_limit
        )
        if timed_out:
            output_str = (
                _truncate_bash_output(output) if output else "[Process started successfully]"
            )
            return (
                f"{output_str}\n\n"
                f"[Background process started and running with exec ID {exec_id}]"
            )
        if not output.strip():
            return "[Command finished with no output]"
        return _truncate_bash_output(output)

    output, timed_out = _read_exec_stream(
        api, exec_id, deadline=time.monotonic() + wait_limit
    )

    if timed_out:
        output_str = (
            _truncate_bash_output(output) if output else "[No output received before timeout]"
        )
        return (
            f"{output_str}\n\n"
            f"[Error: Command timed out after {timeout} seconds and was terminated.]"
        )

    if not output.strip():
        return "[Command finished with no output]"
    return _truncate_bash_output(output)


async def execute_docker_bash(
    command: str,
    container: Optional[str] = None,
    workdir: Optional[str] = None,
    user: Optional[str] = None,
    timeout: int = 30,
    is_background: bool = False,
    default_container: Optional[str] = None,
    default_workdir: Optional[str] = None,
) -> str:
    """
    Executes a bash command inside a running Docker container via the Docker API.

    Container resolution order: ``container`` argument, then ``default_container``
    (typically from ``Agent.create(docker_container=...)``), then
    ``PI_SDK_DOCKER_CONTAINER``, then ``DOCKER_CONTAINER``.

    Workdir resolution order: ``workdir`` argument, then ``default_workdir``
    (typically from ``Agent.create(docker_workdir=...)``), then
    ``PI_SDK_DOCKER_WORKDIR``, then ``DOCKER_WORKDIR``. Omit workdir if unset.

    Uses the app's TCP Docker client (``DOCKER_WSL_IP``) instead of the host CLI.
    """
    resolved_container = _resolve_docker_container(
        container, default_container=default_container
    )
    if not resolved_container:
        return (
            "Error: Docker container not specified. "
            "Pass container=, set Agent.create(docker_container=...), "
            "or set PI_SDK_DOCKER_CONTAINER / DOCKER_CONTAINER."
        )

    resolved_workdir = _resolve_docker_workdir(
        workdir, default_workdir=default_workdir
    )
    should_run_bg = _should_run_background(command, is_background)

    try:
        client = get_sandbox_client()
        if client is None:
            return "Error executing command: Docker client is not configured"
        return await asyncio.to_thread(
            _docker_exec_blocking,
            client,
            resolved_container,
            command,
            resolved_workdir,
            user,
            timeout,
            should_run_bg,
        )
    except NotFound:
        return f"Error executing command: container {resolved_container!r} not found"
    except APIError as exc:
        return _format_bash_error(exc)
    except Exception as exc:
        return _format_bash_error(exc)


DOCKER_BASH_DESCRIPTION = (
    "Run shell/bash commands inside a running Docker container via docker exec. "
    "Use for project commands that must run in the container environment (pytest, npm, migrations, etc.)."
)

DOCKER_BASH_PARAMETERS = {
    "type": "object",
    "properties": {
        "command": {
            "type": "string",
            "description": "Bash command string to execute inside the container.",
        },
        "container": {
            "type": "string",
            "description": (
                "Docker container name or ID. "
                "Defaults to Agent.create(docker_container=...), then "
                "PI_SDK_DOCKER_CONTAINER or DOCKER_CONTAINER env var."
            ),
        },
        "workdir": {
            "type": "string",
            "description": (
                "Working directory inside the container (docker exec -w). "
                "Defaults to Agent.create(docker_workdir=...), then "
                "PI_SDK_DOCKER_WORKDIR or DOCKER_WORKDIR env var."
            ),
        },
        "user": {
            "type": "string",
            "description": "User to run as inside the container (docker exec -u).",
        },
        "timeout": {
            "type": "integer",
            "description": "Maximum time in seconds to wait for command completion (default: 30).",
        },
        "is_background": {
            "type": "boolean",
            "description": "Set to true for long-running background tasks or dev servers.",
        },
    },
    "required": ["command"],
}


def build_docker_bash_tool(
    default_container: Optional[str] = None,
    default_workdir: Optional[str] = None,
) -> ToolSpec:
    async def handler(
        command: str,
        container: Optional[str] = None,
        workdir: Optional[str] = None,
        user: Optional[str] = None,
        timeout: int = 30,
        is_background: bool = False,
        **_: object,
    ) -> str:
        return await execute_docker_bash(
            command,
            container=container,
            workdir=workdir,
            user=user,
            timeout=timeout,
            is_background=is_background,
            default_container=default_container,
            default_workdir=default_workdir,
        )

    return ToolSpec(
        name="docker_bash",
        description=DOCKER_BASH_DESCRIPTION,
        parameters=DOCKER_BASH_PARAMETERS,
        handler=handler,
        require_permission=True,
        permission_arg="command",
    )
