from __future__ import annotations

import os
from typing import Any, Optional

from dotenv import load_dotenv

load_dotenv()

try:
    from docker import DockerClient
    from docker.errors import APIError

    _DOCKER_AVAILABLE = True
except ModuleNotFoundError:
    # Allow the FastAPI server to start even when the `docker` Python package
    # isn't installed. Docker-dependent endpoints/tools will fail later.
    DockerClient = Any  # type: ignore
    APIError = Exception  # type: ignore
    _DOCKER_AVAILABLE = False


SANDBOX_CLIENT: Optional[DockerClient] = None


def get_sandbox_client() -> DockerClient:
    global SANDBOX_CLIENT

    if SANDBOX_CLIENT is not None:
        return SANDBOX_CLIENT

    if not _DOCKER_AVAILABLE:
        raise RuntimeError(
            "Docker Python package is not installed. Install `docker` "
            "or avoid calling Sandbox endpoints/tools."
        )

    docker_host = os.getenv("DOCKER_WSL_IP")
    if not docker_host:
        raise RuntimeError("DOCKER_WSL_IP env var is not set")

    try:
        timeout = int(os.getenv("DOCKER_TIMEOUT", "10"))
        SANDBOX_CLIENT = DockerClient(base_url=f"tcp://{docker_host}", timeout=timeout)
        return SANDBOX_CLIENT
    except (APIError, Exception) as e:
        raise RuntimeError(f"Docker client failed [{getattr(e, 'explanation', e)}]")