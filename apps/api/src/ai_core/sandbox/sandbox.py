from src.ai_core.sandbox.client import get_sandbox_client
from docker import DockerClient
from docker.errors import ContainerError,APIError
class Sandbox:
    
    client:DockerClient|None = None
    def __init__(self):
        self.client = get_sandbox_client()
        
    def run_sandbox(self):
        try:
            if not self.client:
                raise(ModuleNotFoundError("Client is empty"))
            container = self.client.containers.run('node-python-lite',command='tail -f /dev/null',detach=True)
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