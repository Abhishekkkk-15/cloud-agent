# apps/daemon — Architectural Context

`apps/daemon` is the lightweight, autonomous host agent designed to run continuously on developer workstations, laptops, and remote VPS servers. It bridges local developer environments with the Cloud Agent mobile client and gateway.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Host Machine / VPS                   │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │               apps/daemon                      │   │
│   │                                                │   │
│   │  • CLI Entrypoint: 'ca' / 'cloud-agent-daemon' │   │
│   │  • GatewayConnection: Outbound WS dialer       │   │
│   │  • Persistent WS Relay: Direct mobile link     │   │
│   │  • RPC Dispatcher: Remote file/agent executor  │   │
│   │  • Process Pool: Persistent warm CLI workers   │   │
│   │  • Service Manager: systemd / launchd / win    │   │
│   │  • Tunnel Proxy: Web preview port forwarder    │   │
│   └──────────────────────┬─────────────────────────┘   │
│                          │                             │
│   ┌──────────────────────▼─────────────────────────┐   │
│   │     Local AI CLI: Google Antigravity ('agy')   │   │
│   │     Local Git Repositories & Workspaces        │   │
│   └────────────────────────────────────────────────┘   │
└──────────────────────────┬─────────────────────────────┘
                           │ Outbound WebSocket Relay
                           ▼
               ┌───────────────────────┐
               │      apps/gateway     │
               └───────────────────────┘
```

---

## 🔑 Core Subsystems & Directory Structure

```
apps/daemon/src/
├── index.ts        # CLI commander ('start', 'pair', 'workspace', 'service', 'logs', 'expose', 'doctor', 'status')
├── connection.ts   # Outbound WebSocket connection to Gateway hub & heartbeat
├── config.ts       # ~/.cloud-agent/daemon.json configuration loader and serializer
├── registry.ts     # CLI adapter registry (pluggable Antigravity, Claude, etc.)
├── workspace.ts    # Multi-workspace tracking, git branch inspection, and fleet synchronization
├── service.ts      # Background service engine (Linux systemd, macOS launchd, Windows tasks)
├── tunnel.ts       # Local HTTP proxy bridge for web app preview forwarding
├── logger.ts       # Timestamped file logger with rotation to ~/.cloud-agent/daemon.log
├── doctor.ts       # Diagnostic environment checker (Node >=20, Git, Adapters, Network)
└── rpc/            # RPC method handlers
    ├── index.ts        # Primary RPC dispatcher ('daemon.status', 'workspaces.list', etc.)
    ├── run.ts          # Agent run / prompt stream execution & process pool
    ├── session.ts      # Line-by-line NDJSON transcript streaming from disk
    ├── fs.ts           # Safe filesystem operations (tree, read, write, listDirs)
    ├── auto-healer.ts  # Autonomous error reproduction, branch fix & PR generation
    └── github.ts       # GitHub CLI / token authentication & status
```

---

## ⚡ Runtime Data Flow

1. **Outbound Dialing**: The daemon dials outbound to `wss://gateway.cloud-agent.abhishekkkk.in/daemon/ws` using machine credentials stored in `~/.cloud-agent/daemon.json`.
2. **Persistent WebSocket Relay**: The Gateway hub routes RPC requests and streaming events directly between the mobile client and daemon over low-latency persistent WebSockets.
3. **RPC Execution**: Mobile issues RPC requests (`sessions.list`, `agent.run`, `fs.read`, `auto_healer.approve`). The daemon invokes local tools and streams execution events (`text_chunk`, `thought`, `tool_call`, `tool_result`).
4. **Zero-DB Invariant**: Transcripts are streamed line-by-line directly from the CLI's native disk storage (e.g. `~/.gemini/antigravity-cli/brain/...`).
