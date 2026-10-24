# CONTEXT.md — Cloud Agent Platform Context & Architecture Sitemap

This document is the single source of truth outlining the platform architecture, micro-service topologies, communication protocols, network boundaries, and repository layout for all autonomous coding agents and human engineers.

---

## 🎯 Platform Mission & Vision

**Cloud Agent** is a next-generation autonomous AI Cloud IDE and distributed remote coding agent platform. It enables software engineers to:
1. Orchestrate autonomous AI coding agents inside isolated Docker sandboxes with live preview proxies and git synchronization.
2. Remotely operate and command self-hosted machines (VPS, local workstations, or cloud instances) via a zero-database host **Daemon**.
3. Connect securely from anywhere via native mobile/web interfaces through **Zero-Trust WebRTC P2P DataChannels** requiring **0 open inbound firewall ports**.
4. Stream multi-turn agent execution with near-instant responsiveness via warm **Persistent Session Process Pools**.

---

## 🏗️ High-Level System Architecture

```mermaid
flowchart TD
    subgraph MobileWebClients ["Client Surfaces"]
        Mobile["apps/mobile (Expo / React Native Primer Dark)"]
        Web["apps/web (React 19 + Monaco + xterm.js)"]
        Desktop["apps/desktop (Desktop Client)"]
    end

    subgraph ControlPlane ["Central Control Plane & Routing"]
        Gateway["apps/gateway (Gateway Hub :8080)"]
        API["apps/api (FastAPI Core :8000)"]
        Mongo[("MongoDB Database")]
    end

    subgraph HostMachines ["Host Runners (VPS / Workstations)"]
        Daemon["apps/daemon (Host Daemon)"]
        Adapter["packages/cli/antigravity (PersistentWorker Pool)"]
        AgyCLI["Google Antigravity CLI (agy.exe)"]
        Docker["Docker Sandbox Daemon"]
    end

    Mobile <-->|WebRTC DataChannel P2P (Direct Tunnel)| Daemon
    Web <-->|REST & WebSocket| API
    Mobile <-->|Signaling & Machines List| Gateway
    Daemon <-->|Outbound Tunnel /daemon/ws| Gateway
    API <--> Mongo
    Daemon --> Adapter
    Adapter <-->|Persistent stdin/stdout stream-json| AgyCLI
    API <-->|Sandbox Lifecycle| Docker
```

---

## 📁 Repository Directory Map

```
cloud-agent/
├── apps/
│   ├── api/                      # FastAPI Python backend service (:8000)
│   │   ├── src/
│   │   │   ├── ai_core/          # Agent core (pi_sdk), tools (git, read, ask_user), sandboxes
│   │   │   ├── controller/       # REST routes (auth, workspace, chat, sessions, admin)
│   │   │   ├── models/           # Pydantic and Motor MongoDB schemas
│   │   │   ├── repository/       # Data repositories (usage, models, users, sessions)
│   │   │   ├── services/         # Git sync, commit message generation, files service
│   │   │   ├── utils/            # JWT, Google/GitHub OAuth, redis, port manager
│   │   │   └── ws/               # WebSocket handlers (/ws chat, /ws/terminal PTY)
│   │   └── pyproject.toml        # uv Python package definition
│   │
│   ├── web/                      # React 19 + Vite web IDE (:3000)
│   │   ├── src/
│   │   │   ├── components/       # Monaco editor, Terminal, Live Preview, Admin console
│   │   │   ├── stores/           # Zustand stores (workspace, sessions)
│   │   │   └── types/            # TypeScript interfaces & WebSocket events
│   │   └── vite.config.ts        # Bundler configuration
│   │
│   ├── gateway/                  # Gateway Hub & Signaling server (:8080)
│   │   ├── src/
│   │   │   ├── ws/               # Daemon & Client WebRTC signaling handlers
│   │   │   ├── routes/           # Machine inventory & health REST APIs
│   │   │   └── lib/              # JWT verification & machine registry
│   │   └── package.json
│   │
│   ├── daemon/                   # Zero-DB Host Daemon runner
│   │   ├── src/
│   │   │   ├── adapters/         # Registered CLI adapters (Antigravity, Aider, Claude)
│   │   │   ├── tunnel/           # WebRTC DataChannel & Gateway WebSocket tunnel
│   │   │   ├── rpc/              # JSON-RPC method dispatchers (agent.run, daemon.status)
│   │   │   └── telemetry/        # Native CPU, RAM, Disk, and Process monitoring
│   │   └── package.json
│   │
│   ├── mobile/                   # React Native / Expo GitHub Dark mobile app (:8081)
│   │   ├── src/
│   │   │   ├── screens/          # AgentTurn, MachineHealth, Approvals, Sessions
│   │   │   ├── components/       # Primer Dark HeaderBar, MarkdownText, BottomNavBar
│   │   │   ├── lib/              # WebRTC DataChannel P2P client (mobileP2P)
│   │   │   ├── stores/           # Zustand store (useDaemonStore)
│   │   │   └── theme/            # Primer dark design tokens (colors, radii, typography)
│   │   └── package.json
│   │
│   └── desktop/                  # Desktop application client
│
├── packages/
│   ├── shared/                   # Shared TypeScript schemas, contracts & Zod validators
│   ├── cli-interface/            # Standardized CLI event protocol (text_chunk, thought, tool_call)
│   └── cli/antigravity/          # Google Antigravity CLI adapter (PersistentWorker pool)
│
├── turbo.json                    # Turborepo build pipeline configuration
├── pnpm-workspace.yaml           # pnpm workspace package definitions
└── package.json                  # Root monorepo scripts
```

---

## ⚡ Core Pillars & Architectural Principles

### 1. Zero-DB Daemon Architecture
- The host Daemon runs strictly **without any database engine** (no MongoDB, SQLite, or PostgreSQL dependencies on the VPS/host).
- Transcripts and sessions are stream-parsed directly from disk (`.system_generated/logs/transcript.jsonl`) via high-speed line-by-line file streaming.
- Host telemetry (CPU, RAM, Disk, Uptime) is collected natively from the OS via standard platform APIs.

### 2. Zero-Trust WebRTC P2P DataChannels
- The Daemon never opens listening inbound ports on the host.
- Connection sequence:
  1. Daemon establishes an outbound secure WebSocket to `Gateway` (`/daemon/ws`).
  2. Mobile/Web client connects to `Gateway` (`/client/ws`).
  3. Gateway exchanges WebRTC SDP offer, answer, and ICE candidates.
  4. Direct encrypted WebRTC DataChannel opens between client and daemon.
  5. All subsequent RPC methods (`agent.run`, `daemon.status`, `sessions.list`, `agent.approve`) execute peer-to-peer with sub-20ms latency.

### 3. Persistent Session Process Pool
- Spawning a new CLI process per turn caused 10+ second delays due to re-reading 5,000+ line transcript files on disk.
- `PersistentWorker` in `packages/cli/antigravity` solves this by keeping `agy.exe` alive:
  - Spawns in `--input-format stream-json --output-format stream-json --print ""` mode with `stdin` held open.
  - Multi-turn prompts are piped into `stdin` as NDJSON payloads.
  - Turn completion is detected via `parsed.event === "result"` without killing the process.
  - Automatically reaps idle processes after 20 minutes of inactivity.
  - Runs with `--dangerously-skip-permissions` by default to prevent headless terminal hangs on approval prompts.

### 4. GitHub Mobile Copilot UI Standards
- The mobile surface (`apps/mobile`) strictly implements GitHub Mobile's Primer Dark design system:
  - Backgrounds: `#0d1117` (Canvas), `#161b22` (Cards/Surfaces), `#21262d` (Dividers/Pills).
  - Accents: `#238636` (View/Success Green), `#1f6feb` (Submit Blue), `#58a6ff` (Options/Pills), `#79c0ff` (Commit Badges).
  - Native markdown parsing with automatic handling of directory trees, file headers, and commit hashes.

---

## 🔌 Default Port & Network Allocations

| Service | Host & Port | Protocol | Purpose |
| :--- | :--- | :--- | :--- |
| **FastAPI Backend** | `http://127.0.0.1:8000` | HTTP / WS | REST endpoints, WebSocket chat, Docker sandboxes |
| **Preview Proxy** | `http://*.lvh.me:8000` | HTTP | Subdomain reverse proxy to running container ports |
| **Gateway Hub** | `http://localhost:8080` | HTTP / WS | WebRTC signaling hub, machine authentication |
| **Web UI** | `http://localhost:3000` | HTTP | React 19 web IDE & Monaco editor |
| **Mobile Web App** | `http://localhost:8081` | HTTP | Expo / React Native mobile workspace interface |
| **Daemon Tunnel** | `ws://localhost:8080/daemon/ws` | Outbound WS | Secure reverse tunnel to Gateway |

---

## 🔑 Authentication Flow

1. **User Auth**: `POST /auth/dev-login` or OAuth callback returns a standard JWT Access Token (`Bearer <token>`).
2. **Machine Auth**: Each registered host machine generates a token prefix `ca_mach_<hash>` stored in `~/.cloud-agent/daemon.json`.
3. **Gateway Verification**: Gateway validates tokens before allowing peer signaling and machine connection.
