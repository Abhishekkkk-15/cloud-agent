from openai import AsyncOpenAI
from pydantic import BaseModel

from src.utils.config import config


class IntentResponse(BaseModel):
    intent: str
    title: str


class CommitMessageResponse(BaseModel):
    subject: str


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

        return response.choices[0].message.parsed  # type:ignore

    async def suggest_commit_message(
        self,
        *,
        user_query: str = "",
        agent_summary: str = "",
        diff_stat: str = "",
    ) -> str:
        """Return a conventional-commit style subject (≤72 chars)."""
        response = await self.client.beta.chat.completions.parse(
            model=config.intent_model,
            messages=[
                {
                    "role": "system",
                    "content": """
You write git commit subjects for an AI coding agent.

Return JSON with:
- subject: one line, imperative mood, preferably conventional commits
  (feat/fix/chore/refactor/docs/style/perf/test), max 72 characters.

Rules:
- Describe what changed for the user, not that an agent ran.
- Prefer the diff/stat over vague agent prose when they conflict.
- No trailing period, no quotes, no markdown, no body/paragraphs.
- Do not invent files that are not in the diff.
- If the change is unclear, use chore: update project files
""",
                },
                {
                    "role": "user",
                    "content": (
                        f"User request:\n{(user_query or '').strip() or '(none)'}\n\n"
                        f"Agent summary:\n{(agent_summary or '').strip() or '(none)'}\n\n"
                        f"Git changes:\n{(diff_stat or '').strip() or '(none)'}"
                    ),
                },
            ],
            response_format=CommitMessageResponse,
        )
        parsed = response.choices[0].message.parsed
        return (parsed.subject if parsed else "").strip()
