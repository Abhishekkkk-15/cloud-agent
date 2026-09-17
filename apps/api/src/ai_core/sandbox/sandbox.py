from src.ai_core.sandbox.client import get_sandbox_client
from src.schemas.sandbox_schema import SandboxRunResult
from src.utils.config import config
from pathlib import Path

from docker import DockerClient
from docker.errors import APIError, ContainerError, NotFound
from docker.models.containers import Container
from docker.types import Mount
from src.utils.db_client import get_db


class Sandbox:
    client: DockerClient | None
    _client_error: str | None

    def __init__(self):
        self._client_error = None
        try:
            self.client = get_sandbox_client()
        except Exception as e:
            self.client = None
            self._client_error = str(e)

    def run_sandbox(
        self,
        workspace_id: str,
        ports: dict[str, int],
        *,
        skip_template_seed: bool = False,
        memory_limit_mb: int | None = None,
        cpu_limit: float | None = None,
        pids_limit: int | None = None,
    ) -> dict[str, str] | SandboxRunResult:
        try:
            if not self.client:
                return {
                    "error": self._client_error
                    or "Docker sandbox is not available"
                }

            # Callers must prepare files first (prepare_workspace). Only ensure the
            # mount directory exists so Docker bind-mount succeeds.
            Path(config.workspace_base / workspace_id).mkdir(parents=True, exist_ok=True)

            mount = Mount(
                target="/app",
                source=f"{config.docker_workspace_base}/{workspace_id}",
                type="bind",
            )
            environment = {"SKIP_TEMPLATE_SEED": "1"} if skip_template_seed else None

            # Apply container resource limits (RAM, CPU, and PIDs) to prevent system exhaustion
            effective_mem = memory_limit_mb or getattr(config, "sandbox_memory_limit_mb", 2048)
            effective_cpu = cpu_limit or getattr(config, "sandbox_cpu_limit", 2.0)
            effective_pids = pids_limit or getattr(config, "sandbox_pids_limit", 500)

            run_kwargs: dict = {
                "command": "tail -f /dev/null",
                "detach": True,
                "mounts": [mount],
                "ports": ports,
                "environment": environment,
            }
            if effective_mem and effective_mem > 0:
                run_kwargs["mem_limit"] = f"{int(effective_mem)}m"
            if effective_cpu and effective_cpu > 0:
                run_kwargs["nano_cpus"] = int(effective_cpu * 1e9)
            if effective_pids and effective_pids > 0:
                run_kwargs["pids_limit"] = int(effective_pids)

            container = self.client.containers.run(
                "node-python-lite",
                **run_kwargs,
            )
            print("2. Container created:", container.id)

            print("3. Reloading container")
            container.reload()

            print("4. Status:", container.status)
            if (
                container.id is None
                or container.name is None
                or container.status is None
            ):
                raise RuntimeError("Container metadata missing")
            container_res = SandboxRunResult(
                id=container.id, name=container.name, status=container.status
            )
            return container_res
        except ContainerError as e:
            return {"error": f"Container Error: {getattr(e, 'stderr', e)}"}
        except Exception as e:
            return {"error": f"Failed to run sandbox container: {e}"}

    def docker_ls(self):
        try:
            if not self.client:
                return []

            containers = self.client.containers.list()

            return [
                {
                    "id": container.short_id,
                    "name": container.name,
                    "status": container.status,
                    "image": (
                        container.image.tags[0]  # type:ignore
                        if container.image.tags  # type:ignore
                        else container.image.short_id  # type:ignore
                    ),
                    "created": container.attrs.get("Created"),
                }
                for container in containers
            ]
        except Exception as e:
            return [{"error": f"Failed to list containers: {e}"}]

    def resume_sandbox(
        self,
        sandbox_id: str,
    ) -> dict[str, str] | SandboxRunResult:
        try:
            if not self.client:
                return {
                    "error": self._client_error
                    or "Docker sandbox is not available"
                }

            container = self.client.containers.get(sandbox_id)

            container.reload()

            if container.status != "running":
                container.start()
                container.reload()

            if (
                container.id is None
                or container.name is None
                or container.status is None
            ):
                raise RuntimeError("Container metadata missing")

            return SandboxRunResult(
                id=container.id,
                name=container.name,
                status=container.status,
            )

        except NotFound:
            return {"error": f"Sandbox '{sandbox_id}' not found"}

        except ContainerError as e:
            return {"error": f"Container Error: {getattr(e, 'stderr', e)}"}

        except APIError as e:
            return {"error": f"Docker API Error: {e}"}

        except Exception as e:
            return {"error": f"Failed to resume sandbox: {e}"}

    def sandbox_exists(self, sandbox_id: str) -> bool:
        if not self.client:
            return False

        try:
            self.client.containers.get(sandbox_id)
            return True
        except NotFound:
            return False
        except Exception:
            return False

    def sandbox_get(self, sandbox_id: str) -> Container | None:
        if not self.client:
            return None

        try:
            cnt = self.client.containers.get(sandbox_id)
            print(cnt.stats)
            return cnt
        except NotFound:
            return None
        except Exception:
            return None

    def is_sandbox_running(self, sandbox_id: str) -> bool:
        if not self.client:
            return False

        try:
            container = self.client.containers.get(sandbox_id)
            container.reload()

            return container.status == "running"

        except NotFound:
            return False

    def stop_sandbox(self, container_id: str) -> dict[str, str] | None:
        try:
            if not self.client:
                return {
                    "error": self._client_error or "Docker is not available"
                }
            container = self.client.containers.get(container_id)
            container.stop()
            return None
        except NotFound:
            return {"error": f"Container '{container_id}' not found"}
        except ContainerError as e:
            return {"error": f"Container Error: {getattr(e, 'stderr', e)}"}
        except APIError as e:
            return {"error": f"Docker API Error: {e}"}
        except Exception as e:
            return {"error": f"Failed to stop container: {e}"}

    def delete_sandbox(self,container_id:str) -> dict[str, str] | None:
        try:
            if not self.client:
                return {
                    "error": self._client_error or "Docker is not available"
                }
            container = self.client.containers.get(container_id)
            container.remove()
            return None
        except NotFound:
            return {"error": f"Container '{container_id}' not found"}
        except ContainerError as e:
            return {"error": f"Container Error: {getattr(e, 'stderr', e)}"}
        except APIError as e:
            return {"error": f"Docker API Error: {e}"}
        except Exception as e:
            return {"error": f"Failed to delete container: {e}"}
        
    def run_exec(self, sandbox_id: str, cmd: str | list[str]) -> dict[str, str] | bool:
        ctn = self.sandbox_get(sandbox_id=sandbox_id)
        if ctn is None:
            return {"error": "sandbox not found"}
        exit_code, output = ctn.exec_run(cmd)
        return {"exit_code": exit_code, "output": output}
