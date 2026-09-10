from fastapi import HTTPException, status

from src.models.ai_model import AIModel
from src.repository.model_repository import ModelRepo
from src.schemas.model_schema import (
    CreateModelRequest,
    ModelResponse,
    UpdateModelRequest,
)


def _to_response(model: AIModel) -> ModelResponse:
    return ModelResponse(
        id=model.id or "",
        name=model.name,
        model_id=model.model_id,
        provider=model.provider,
        url=model.url or model.base_url,
        base_url=model.base_url or model.url,
        api_key_env=model.api_key_env,
        has_api_key=bool(model.api_key),
        is_active=model.is_active,
        is_default=model.is_default,
        supports_effort=model.supports_effort,
        default_effort=model.default_effort,
        use_case=model.use_case,
        badge=model.badge,
        description=model.description,
        context_window=model.context_window,
        max_tokens=model.max_tokens,
        input_price_per_mtok=model.input_price_per_mtok,
        output_price_per_mtok=model.output_price_per_mtok,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


async def get_active_models(
    repo: ModelRepo,
    provider: str | None = None,
    use_case: str | None = None,
) -> list[ModelResponse]:
    if use_case:
        models = await repo.find_by_use_case(use_case)
    else:
        models = await repo.find_all(active_only=True, provider=provider)
    return [_to_response(m) for m in models]


async def get_all_models(
    repo: ModelRepo,
    provider: str | None = None,
) -> list[ModelResponse]:
    models = await repo.find_all(active_only=False, provider=provider)
    return [_to_response(m) for m in models]


async def get_model_details(
    model_id: str,
    repo: ModelRepo,
) -> ModelResponse:
    model = await repo.find_by_id(model_id)
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{model_id}' not found",
        )
    return _to_response(model)


async def create_model(
    body: CreateModelRequest,
    repo: ModelRepo,
) -> ModelResponse:
    existing = await repo.find_by_id(body.model_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Model with model_id '{body.model_id}' already exists",
        )

    effective_url = body.url or body.base_url
    model = AIModel(
        name=body.name,
        model_id=body.model_id,
        provider=body.provider,
        url=effective_url,
        base_url=body.base_url or effective_url,
        api_key=body.api_key,
        api_key_env=body.api_key_env,
        is_active=body.is_active,
        is_default=body.is_default,
        supports_effort=body.supports_effort,
        default_effort=body.default_effort,
        use_case=body.use_case,
        badge=body.badge,
        description=body.description,
        context_window=body.context_window,
        max_tokens=body.max_tokens,
        input_price_per_mtok=body.input_price_per_mtok,
        output_price_per_mtok=body.output_price_per_mtok,
    )
    saved = await repo.create(model)
    return _to_response(saved)


async def update_model(
    model_id: str,
    body: UpdateModelRequest,
    repo: ModelRepo,
) -> ModelResponse:
    existing = await repo.find_by_id(model_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{model_id}' not found",
        )

    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        return _to_response(existing)

    # Sync url and base_url if one was provided
    if "url" in update_data and "base_url" not in update_data:
        update_data["base_url"] = update_data["url"]
    elif "base_url" in update_data and "url" not in update_data:
        update_data["url"] = update_data["base_url"]

    updated = await repo.update(model_id, update_data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update model",
        )
    return _to_response(updated)


async def delete_model(
    model_id: str,
    repo: ModelRepo,
) -> None:
    deleted = await repo.delete(model_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model '{model_id}' not found",
        )


async def seed_default_models(
    repo: ModelRepo,
) -> dict:
    models = await repo.seed_default_models()
    return {
        "status": "success",
        "message": f"Successfully initialized {len(models)} default models",
        "count": len(models),
    }
