from datetime import datetime
from pydantic import BaseModel, Field


class CreateModelRequest(BaseModel):
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


class UpdateModelRequest(BaseModel):
    name: str | None = None
    model_id: str | None = None
    provider: str | None = None
    url: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    api_key_env: str | None = None
    is_active: bool | None = None
    is_default: bool | None = None
    supports_effort: bool | None = None
    default_effort: str | None = None
    use_case: list[str] | None = None
    badge: str | None = None
    description: str | None = None
    context_window: int | None = None
    max_tokens: int | None = None
    input_price_per_mtok: float | None = None
    output_price_per_mtok: float | None = None


class ModelResponse(BaseModel):
    id: str
    name: str
    model_id: str
    provider: str
    url: str | None = None
    base_url: str | None = None
    api_key_env: str | None = None
    has_api_key: bool = False
    is_active: bool
    is_default: bool
    supports_effort: bool
    default_effort: str | None = None
    use_case: list[str] = Field(default_factory=list)
    badge: str | None = None
    description: str = ""
    context_window: int | None = None
    max_tokens: int | None = None
    input_price_per_mtok: float = 0.0
    output_price_per_mtok: float = 0.0
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ModelListResponse(BaseModel):
    models: list[ModelResponse]
    total: int
