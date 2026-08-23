from src.ai_core.sandbox.client import get_sandbox_client
from docker import DockerClient
from docker.errors import ContainerError,APIError
from docker.types import Mount
class Sandbox:
    
    client:DockerClient|None = None
    def __init__(self):
        self.client = get_sandbox_client()
        
    def run_sandbox(self):
        try:
            if not self.client:
                raise(ModuleNotFoundError("Client is empty"))
            
            # mount = Mount.parse_mount_string("F:/study/cloud-agent/sandbox/mounts/workspace/first_workspace:app/project")
            mount = Mount(
                target="/app/projects",
                source="/mnt/f/study/cloud-agent/sandbox/mounts/workspace/first_workspace",
                type="bind"
            )
            container = self.client.containers.run('node-python-lite',command='tail -f /dev/null',detach=True,mounts=[mount])
            
            return container
        except ContainerError as e:
            return f"Container Error {e.stderr}"
        
    def docker_ls(self):
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