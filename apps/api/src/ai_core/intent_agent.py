from openai import AsyncOpenAI
from pydantic import BaseModel

from src.utils.config import config


class IntentResponse(BaseModel):
    intent: str
    title: str


class IntentAgent:
    def __init__(self):
        self.client = AsyncOpenAI(
            base_url=config.intent_base_url,
            api_key=config.intent_model_key,
        )

    async def analyze(self, prompt: str) -> IntentResponse:
        response = await self.client.beta.chat.completions.parse(
            model=config.intent_model,
            messages=[
                {
                    "role": "system",
                    "content": """
You analyze a user's request.

Return:
1. intent - a short snake_case intent label.
2. title - a concise workspace/session title (3-8 words).

Examples:

User: Build a FastAPI websocket chat app
Intent: build_web_app
Title: FastAPI WebSocket Chat App

User: Fix Docker container startup error
Intent: debug_error
Title: Docker Startup Error

User: Create a React dashboard for sales analytics
Intent: build_dashboard
Title: Sales Analytics Dashboard

Rules:
- intent must be short and machine-friendly.
- use snake_case.
- title should be human-friendly.
- title should not exceed 8 words.
""",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            response_format=IntentResponse,
        )

        return response.choices[0].message.parsed #type:ignore