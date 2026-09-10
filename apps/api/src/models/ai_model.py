from datetime import datetime, timezone
from pydantic import BaseModel, Field


class AIModel(BaseModel):
    id: str | None = None
    name: str
    model_id: str
    provider: str
    url: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    api_key_env: str | None = None
    is_active: bool = True
    is_default: bool = False
    supports_effort: bool = False
    default_effort: str | None = None
    use_case: list[str] = Field(default_factory=list)
    badge: str | None = None
    description: str = ""
    context_window: int | None = None
    max_tokens: int | None = None
    input_price_per_mtok: float = 0.0
    output_price_per_mtok: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def effective_url(self) -> str | None:
        return self.url or self.base_url

    def to_pi_sdk_config(self) -> dict:
        """Helper to convert model config into pi-sdk AgentOptions compatible dict."""
        return {
            "model": self.model_id,
            "provider": self.provider,
            "base_url": self.effective_url,
            "reasoning_effort": self.default_effort if self.supports_effort else None,
            "input_price_per_mtok": self.input_price_per_mtok,
            "output_price_per_mtok": self.output_price_per_mtok,
        }


# Aliases for convenience
LLMModel = AIModel
ModelEntity = AIModel
