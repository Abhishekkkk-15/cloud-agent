from typing import Any, Optional

from src.ai_core.sandbox.client import get_sandbox_client
from src.utils.config import Config
from src.schemas.sandbox_schema import SandboxRunResult
# from docker import Con

from src.utils.config import config

from docker.errors import ContainerError, APIError,NotFound
try:
    from docker import DockerClient
    from docker.errors import ContainerError, APIError,NotFound
    from docker.types import Mount
    

    _DOCKER_AVAILABLE = True
except ModuleNotFoundError:
    # Allow the app to import/start without the `docker` Python package.
    ContainerError = Exception  # type: ignore
    APIError = Exception  # type: ignore
    Mount = None  # type: ignore
    _DOCKER_AVAILABLE = False
class Sandbox:
    client :DockerClient | None
    def __init__(self):
        try:
            self.client = get_sandbox_client()
        except Exception:
            self.client = None
    def run_sandbox(self,workspace_id:str)-> dict[str, str] | SandboxRunResult :
        try:
            if not _DOCKER_AVAILABLE or not self.client:
                return {"error": "Docker sandbox is not available"}

            if Mount is None:
                return {"error": "docker.types.Mount is unavailable"}
            
            mount = Mount(
                target="/app",
                source=f"{config.docker_workspace_base}/{workspace_id}",
                type="bind"
            )
            container = self.client.containers.run('node-python-lite', command='tail -f /dev/null', detach=True, mounts=[mount])
            if (
                container.id is None
                or container.name is None
                or container.status is None
                ):          
                raise RuntimeError("Container metadata missing")            
            container_res = SandboxRunResult(id=container.id,name=container.name, status=container.status)
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
                        container.image.tags[0]
                        if container.image.tags
                        else container.image.short_id
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
) ->     dict[str, str] | SandboxRunResult:
        try:
            if not _DOCKER_AVAILABLE or not self.client:
                return {"error": "Docker sandbox is not available"}

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
            return {
                "error": f"Container Error: {getattr(e, 'stderr', e)}"
            }

        except APIError as e:
            return {
                "error": f"Docker API Error: {e}"
            }

        except Exception as e:
            return {
                "error": f"Failed to resume sandbox: {e}"
            }         
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
    def is_sandbox_running(self, sandbox_id: str) -> bool:
        if not self.client:
            return False

        try:
            container = self.client.containers.get(sandbox_id)
            container.reload()

            return container.status == "running"

        except NotFound:
            return False
    
        