from src.ai_core.sandbox.sandbox import Sandbox
from typing import Annotated, Any
from fastapi import Depends
sandbox_manager = Sandbox()

def get_sandbox_manager():
    return sandbox_manager

SandboxRepo = Annotated[Sandbox,Depends(get_sandbox_manager)]