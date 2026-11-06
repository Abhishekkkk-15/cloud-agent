# apps/api — Autonomous Agent Guidelines

This document provides development instructions, operational rules, and safety boundaries for autonomous AI agents and engineers working on `apps/api`.

---

## 📜 Invariants & Operational Rules

### 1. 0.0.0.0 Server Bind Rule
- **ALWAYS** bind the FastAPI server to `0.0.0.0` (port `8000`), **never** `127.0.0.1`.
- Binding to `127.0.0.1` prevents Docker containers, Gateway proxies, and mobile clients over local Wi-Fi from reaching the API.

### 2. Sandbox Container Safety
- Destructive commands must always be sandboxed inside ephemeral Docker containers (`src/ai_core/sandbox/`). Never execute untrusted agent shell commands directly on the host OS.

### 3. Asynchronous Execution
- Use `async` and `await` for all I/O operations (MongoDB queries, Docker API calls, LLM streaming). Do not block the asyncio event loop with synchronous sleeps or HTTP requests.

### 4. Pydantic Type Validation
- All request payloads and response bodies must be strictly typed using Pydantic schemas in `src/schemas/`.

---

## 🛠️ Verification & Execution Commands

```bash
# Enter directory
cd apps/api

# Run local development server
uv run main.py

# Run tests
uv run pytest
```
