from pi_sdk import Agent, RunResult
from src.utils.config import Config

class CloudAgentCore:
    client:Agent
    def __init__(self) -> None:
        sys_config = Config()
        self.config = sys_config
        self.client = Agent.create(
            api_key= sys_config.api_key,
            provider=sys_config.provider,
            autonomous=sys_config.autonomous,
            model=sys_config.model,
            storage="disk"
        )
    
    def run(self,msg:str) -> RunResult:
        return self.client.run(msg)
        
        