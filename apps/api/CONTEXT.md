# apps/api — Architectural Context

`apps/api` is the Python FastAPI backend for Cloud Agent. It powers the core AI reasoning engine, autonomous intent agent, secure sandbox container execution, and GitHub integration.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│                      apps/api                          │
│               (FastAPI / Uvicorn :8000)                │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │                 API Routes                     │   │
│   │  • /auth/*        (Google Auth, JWT validation)│   │
│   │  • /agent/*       (AI turn stream & intent)    │   │
│   │  • /github/*      (PR reviews & issue triage)  │   │
│   │  • /sandbox/*     (Container execution queue)  │   │
│   └──────────────────────┬─────────────────────────┘   │
│                          │                             │
│   ┌──────────────────────▼─────────────────────────┐   │
│   │                 AI Core                        │   │
│   │  • CloudAgent & IntentAgent (Gemini Models)    │   │
│   │  • Tool Registry (Docker, Git, Read, Write)    │   │
│   │  • Sandbox Manager (Isolated Docker Bash)      │   │
│   └──────────────────────┬─────────────────────────┘   │
└──────────────────────────┼─────────────────────────────┘
                           │
                           ▼
               ┌───────────────────────┐
               │     MongoDB Atlas     │
               │   Docker Daemon       │
               └───────────────────────┘
```

---

## 🔑 Core Subsystems & Directory Structure

```
apps/api/src/
├── main.py             # FastAPI application entrypoint, CORS & middleware
├── ai_core/            # AI reasoning & execution
│   ├── cloud_agent.py      # Core agent loop with tool orchestration
│   ├── intent_agent.py     # Intent classification and prompt understanding
│   ├── tools/              # Tool definitions (git, file, docker, ask_user)
│   └── sandbox/            # Docker container isolation and command execution
├── controller/         # Request handling logic (auth, admin, github)
├── routes/             # FastAPI router definitions
├── models/             # ODM models (MongoDB Beanie/Motor)
├── schemas/            # Pydantic validation schemas
├── services/           # Business logic & background queues
└── utils/              # JWT, Google token verification, crypto
```

---

## ⚡ Runtime Data Flow

1. **Authentication**: Validates Google ID tokens and creates JWT token pairs.
2. **Autonomous Intent Pipeline**: Translates developer prompts into actionable sub-tasks.
3. **Sandbox Execution**: Commands are executed within secure Docker containers, streaming stdout and stderr in real-time.
4. **Git Operations**: Creates branches, generates commits, and posts automated PR reviews.
