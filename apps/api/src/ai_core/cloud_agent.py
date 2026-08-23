from pi_sdk import Agent, RunResult
from src.ai_core.sandbox.docker_bash import build_docker_bash_tool
from src.utils.config import Config

DEFAULT_DOCKER_CONTAINER = "74525c90f22c"
DEFAULT_DOCKER_WORKDIR = "/app/projects"


class CloudAgentCore:
    client: Agent

    def __init__(self) -> None:
        sys_config = Config()
        self.config = sys_config
        self.client = Agent.create(
            api_key=sys_config.api_key,
            provider=sys_config.provider,
            autonomous=sys_config.autonomous,
            model=sys_config.model,
            storage="disk",
            docker_container=DEFAULT_DOCKER_CONTAINER,
            docker_workdir=DEFAULT_DOCKER_WORKDIR,
            disable_tools=["bash"],
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
