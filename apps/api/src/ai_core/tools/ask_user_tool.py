import asyncio
import json
import uuid
from typing import Any, Callable, Coroutine
from pi_sdk import ToolSpec

ASK_USER_DESCRIPTION = """Use this tool when you need input, decisions, preferences, secrets, or configuration from the user.
Execution of your plan will pause until the user answers through the interactive form rendered in their UI.

Supported question types:
- 'text': Simple text response.
- 'secret': Masked password/API key/token input.
- 'select': Single-choice selection from a list of options.
- 'multiselect': Multi-choice checkboxes from a list of options.
- 'confirm': Quick Yes / No confirmation.

Always formulate concise questions with sensible defaults where applicable.
"""

ASK_USER_PARAMETERS = {
    "type": "object",
    "properties": {
        "title": {
            "type": "string",
            "description": "Short title describing the request (e.g., 'API Keys Required', 'Select Database Stack').",
        },
        "description": {
            "type": "string",
            "description": "Optional explanation of why this information is needed.",
        },
        "questions": {
            "type": "array",
            "description": "List of questions to present to the user.",
            "items": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "Unique identifier for this question (e.g. 'stripe_key', 'db_type').",
                    },
                    "type": {
                        "type": "string",
                        "enum": ["text", "secret", "select", "multiselect", "confirm"],
                        "description": "Type of UI component to render for this question.",
                    },
                    "question": {
                        "type": "string",
                        "description": "The prompt or question label displayed to the user.",
                    },
                    "placeholder": {
                        "type": "string",
                        "description": "Placeholder text for text/secret input.",
                    },
                    "options": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Selectable choices (required for 'select' and 'multiselect').",
                    },
                    "default": {
                        "description": "Default value (string, boolean, or array of strings).",
                    },
                    "required": {
                        "type": "boolean",
                        "description": "Whether this question must be answered before submitting (default: true).",
                    },
                },
                "required": ["id", "type", "question"],
            },
        },
    },
    "required": ["title", "questions"],
}


def build_ask_user_tool(
    on_ask_user: Callable[[dict[str, Any]], Coroutine[Any, Any, None]],
    pending_answers_map: dict[str, asyncio.Future],
) -> ToolSpec:
    """Builds the ask_user tool for pi_sdk agents.
    
    `on_ask_user` sends the WebSocket payload to the frontend.
    `pending_answers_map` stores the asyncio.Future waiting for the user's answer.
    """

    async def handler(
        title: str,
        questions: list[dict[str, Any]],
        description: str | None = None,
        **_: object,
    ) -> str:
        request_id = f"ask_{uuid.uuid4().hex[:12]}"
        loop = asyncio.get_running_loop()
        future: asyncio.Future = loop.create_future()
        pending_answers_map[request_id] = future

        # Send interactive question card to the client over WebSocket
        payload = {
            "request_id": request_id,
            "title": title,
            "description": description or "",
            "questions": questions,
        }

        try:
            await on_ask_user(payload)
            # Await user submission from frontend
            answers = await future
            return json.dumps(
                {"status": "answered", "answers": answers},
                indent=2,
            )
        except asyncio.CancelledError:
            return json.dumps({"status": "cancelled", "message": "Question was aborted."})
        except Exception as err:
            return json.dumps({"status": "error", "message": str(err)})
        finally:
            pending_answers_map.pop(request_id, None)

    return ToolSpec(
        name="ask_user",
        description=ASK_USER_DESCRIPTION,
        parameters=ASK_USER_PARAMETERS,
        handler=handler,
        require_permission=False,
    )
