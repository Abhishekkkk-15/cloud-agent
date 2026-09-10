from fastapi import APIRouter, status

from src.controller.model_controller import (
    create_model,
    delete_model,
    get_active_models,
    get_all_models,
    get_model_details,
    seed_default_models,
    update_model,
)
from src.schemas.model_schema import ModelResponse

router = APIRouter(prefix="/models", tags=["Models"])

router.get("", response_model=list[ModelResponse])(get_active_models)
router.get("/all", response_model=list[ModelResponse])(get_all_models)
router.post("/seed", response_model=dict)(seed_default_models)
router.get("/{model_id}", response_model=ModelResponse)(get_model_details)
router.post(
    "",
    response_model=ModelResponse,
    status_code=status.HTTP_201_CREATED,
)(create_model)
router.put("/{model_id}", response_model=ModelResponse)(update_model)
router.delete(
    "/{model_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)(delete_model)
