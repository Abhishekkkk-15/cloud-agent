from pi_sdk import Agent, RunResult
from src.utils.config import Config


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
        )

    async def run(self, msg: str) -> RunResult:
        print("\n Run \n")
        return await self.client.run(msg)

    async def resume(self, session_id: str) -> Agent:
        print("Resumed")
        return await self.client.resume(session_id)
