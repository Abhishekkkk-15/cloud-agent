from typing import Any, Optional

from src.ai_core.sandbox.client import get_sandbox_client
from src.utils.config import Config

try:
    from docker import DockerClient
    from docker.errors import ContainerError, APIError
    from docker.types import Mount

    _DOCKER_AVAILABLE = True
except ModuleNotFoundError:
    # Allow the app to import/start without the `docker` Python package.
    DockerClient = Any  # type: ignore
    ContainerError = Exception  # type: ignore
    APIError = Exception  # type: ignore
    Mount = None  # type: ignore
    _DOCKER_AVAILABLE = False
class Sandbox:
    
    client: Optional[DockerClient] = None
    def __init__(self):
        self.config = Config()
        # Docker can be missing/unreachable; don't block server startup.
        try:
            self.client = get_sandbox_client()
        except Exception:
            self.client = None
    def run_sandbox(self):
        try:
            if not _DOCKER_AVAILABLE or not self.client:
                return "Error: Docker sandbox is not available"

            if Mount is None:
                return "Error: docker.types.Mount is unavailable"
            
            # mount = Mount.parse_mount_string("F:/study/cloud-agent/sandbox/mounts/workspace/first_workspace:app/project")
            # mount = Mount(
            #     target="/app/projects",
            #     source="",
            #     type="bind"
            # )
            mount = Mount(
                target=self.config.sandbox_target,
                source=self.config.sandbox_mount + "/first_workspace",
                type="bind"
            )
            container = self.client.containers.run('node-python-lite',command='tail -f /dev/null',detach=True,mounts=[mount])
            
            return container
        except ContainerError as e:
            return f"Container Error {e.stderr}"
        
    def docker_ls(self):
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