from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Optional

from docker import DockerClient, from_env
from docker.errors import APIError
from dotenv import load_dotenv

load_dotenv()


SANDBOX_CLIENT: Optional[DockerClient] = None


def _bypass_broken_creds_store() -> None:
    """Avoid docker-credential-desktop when it isn't on PATH.

    docker-py still reads ~/.docker/config.json for pulls; a minimal
    DOCKER_CONFIG with no credsStore is enough for local images.
    """
    if os.getenv("DOCKER_CONFIG"):
        return

    cfg_dir = Path(tempfile.gettempdir()) / "cloud-agent-docker-config"
    cfg_dir.mkdir(parents=True, exist_ok=True)
    cfg_path = cfg_dir / "config.json"
    if not cfg_path.exists():
        cfg_path.write_text(json.dumps({"auths": {}}), encoding="utf-8")
    os.environ["DOCKER_CONFIG"] = str(cfg_dir)


def get_sandbox_client() -> DockerClient:
    global SANDBOX_CLIENT

    if SANDBOX_CLIENT is not None:
        return SANDBOX_CLIENT

    _bypass_broken_creds_store()

    try:
        timeout = int(os.getenv("DOCKER_TIMEOUT", "10"))
        docker_host = (os.getenv("DOCKER_WSL_IP") or "").strip().strip('"').strip("'")

        # Prefer Docker Desktop named pipe / DOCKER_HOST via from_env.
        # Only use TCP when explicitly forced — plain DOCKER_WSL_IP:2375 is
        # often unset in Desktop (expose daemon on tcp://localhost:2375).
        use_tcp = os.getenv("DOCKER_USE_TCP", "").lower() in {"1", "true", "yes"}
        if use_tcp and docker_host:
            SANDBOX_CLIENT = DockerClient(
                base_url=f"tcp://{docker_host}",
                timeout=timeout,
            )
        else:
            SANDBOX_CLIENT = from_env(timeout=timeout)

        SANDBOX_CLIENT.ping()
        return SANDBOX_CLIENT
    except (APIError, Exception) as e:
        SANDBOX_CLIENT = None
        raise RuntimeError(f"Docker client failed [{getattr(e, 'explanation', e)}]") from e
