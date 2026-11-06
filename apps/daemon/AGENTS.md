# apps/daemon — Autonomous Agent Guidelines

This document provides strict operational constraints, coding rules, and safety boundaries for autonomous AI agents and human engineers modifying `apps/daemon`.

---

## 📜 Invariants & Golden Rules

### 1. Zero-DB Daemon Invariant
- **NEVER** install or introduce MongoDB, SQLite, PostgreSQL, Prisma, TypeORM, or any external database into `apps/daemon`.
- All persistent configuration must live in simple JSON files under `~/.cloud-agent/daemon.json`.
- Agent transcripts and chat turns must be read directly from the CLI's native disk files using streaming line-by-line NDJSON readers.

### 2. Zero Inbound Ports Invariant
- **NEVER** add listening HTTP or socket servers to the Daemon (e.g. `http.createServer().listen(...)` or `new WebSocketServer({ port })`).
- The daemon must only establish **outbound** connections to the Gateway hub (`/daemon/ws`). This ensures it operates seamlessly behind NAT, CGNAT, corporate firewalls, and cloud security groups without port forwarding.

### 3. Headless Execution & Permission Bypass
- The daemon runs headlessly as a background service without a human terminal (`TTY`).
- Always ensure permission bypass flags (such as `--dangerously-skip-permissions` in `packages/cli/antigravity`) are supplied so processes never hang waiting for interactive user confirmation (`[y/n]`).

### 4. Warm Persistent Process Pool
- Do **NOT** spawn a brand-new CLI process per chat turn. Re-reading massive session transcripts from disk introduces 10+ seconds of cold-start latency.
- Always maintain persistent worker processes with open `stdin` pipes for active sessions and stream new user prompts progressively.

### 5. Graceful Process Lifecycle
- Always trap `SIGINT` and `SIGTERM` signals to cleanly close WebSocket connections, terminate child processes, and clean up temporary state.

---

## 🛠️ Verification & Testing Commands

Before completing any task affecting `apps/daemon`, execute:

```bash
# Typecheck daemon package
pnpm --filter @cloud-agent/daemon typecheck

# Build daemon package
pnpm --filter @cloud-agent/daemon build

# Run diagnostic check
pnpm --filter @cloud-agent/daemon dev doctor

# Inspect workspaces
pnpm --filter @cloud-agent/daemon dev workspace list
```
