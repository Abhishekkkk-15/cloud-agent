from pi_sdk import Agent, RunResult
from src.ai_core.sandbox.docker_bash import build_docker_bash_tool
from src.utils.config import Config

DEFAULT_DOCKER_CONTAINER = "81f6e465fc11"
DEFAULT_DOCKER_WORKDIR = "/app/projects"
WORKSPACE_ROOT = "F:/study/cloud-agent/sandbox/mounts/workspace/first_workspace"




class CloudAgentCore:
    client: Agent

    def __init__(self) -> None:
        sys_config = Config()
        self.config = sys_config
        self.client = Agent.create(
            api_key=sys_config.api_key,
            provider=sys_config.provider,
            base_url=sys_config.base_url,
            autonomous=sys_config.autonomous,
            model=sys_config.model,
            storage="disk",
            docker_container=DEFAULT_DOCKER_CONTAINER,
            docker_workdir=DEFAULT_DOCKER_WORKDIR,
            disable_tools=["bash"],
            cwd=WORKSPACE_ROOT,
            max_retries=3,
            retry_on_rate_limit=True,
            extra_tools=[
                build_docker_bash_tool(
                    default_container=DEFAULT_DOCKER_CONTAINER,
                    default_workdir=DEFAULT_DOCKER_WORKDIR,
                ),
            ],
        )


    async def run(self, msg: str) -> RunResult:
        print("\n Run \n")
        return await self.client.run(msg)

    async def resume(self, session_id: str) -> Agent:
        print("Resumed")
        return await self.client.resume(session_id)
    async def stream(self,msg:str):
        async for event in self.client.stream(msg):
            print(event.type.value, event.data)