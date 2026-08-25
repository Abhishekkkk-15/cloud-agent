from pi_sdk import Agent, RunResult
from src.ai_core.sandbox.docker_bash import build_docker_bash_tool
from src.utils.config import config

DEFAULT_DOCKER_WORKDIR = "/app"


sys_config = config

class CloudAgentCore:
    client: Agent

    def __init__(self,workspace_id:str,container_id,user_id:str) -> None:
        self.config = sys_config
        self.client = Agent.create(
            api_key=sys_config.api_key,
            provider=sys_config.provider,
            base_url=sys_config.base_url,
            autonomous=sys_config.autonomous,
            model=sys_config.model,
            storage="mongodb",
            mongodb_uri=sys_config.database_uri,
            mongodb_db=sys_config.database_name,
            user_id=user_id,
            docker_container=container_id,
            docker_workdir=DEFAULT_DOCKER_WORKDIR,
            workspace_id=workspace_id,
            disable_tools=["bash"],
            cwd=sys_config.workspace_base/workspace_id,
            max_retries=3,
            retry_on_rate_limit=True,
            extra_tools=[
                build_docker_bash_tool(
                    default_container=container_id,
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