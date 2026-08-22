from docker import DockerClient
from docker.errors import APIError


SANDBOX_CLIENT:DockerClient |None  = None

def get_sandbox_client() -> DockerClient:
    global SANDBOX_CLIENT
    print("GOT here")
    if SANDBOX_CLIENT is not None:
        return SANDBOX_CLIENT
    try:
        client = DockerClient(base_url="tcp://127.0.0.1:2375")
        SANDBOX_CLIENT = client
        return SANDBOX_CLIENT
    except APIError as e:
        raise(RuntimeError(f"Docker client failed [{e.explanation}]",))