# apps/gateway — Autonomous Agent Guidelines

This document provides development instructions, operational rules, and safety boundaries for autonomous AI agents and engineers working on `apps/gateway`.

---

## 📜 Invariants & Operational Rules

### 1. 0.0.0.0 Server Bind Rule
- **ALWAYS** bind the HTTP server in `apps/gateway` to `0.0.0.0`, **never** `127.0.0.1`.
- Binding to `127.0.0.1` prevents mobile devices (Expo Go / physical devices over Wi-Fi) and external daemons from establishing connections, causing `ConnectException`.

### 2. Zero-DB Daemon Separation
- Remember that `apps/gateway` interacts with MongoDB, but `apps/daemon` must remain completely database-free. Never leak DB drivers or database queries into daemon RPC responses.

### 3. Non-Blocking Async Routing
- Gateway handles thousands of concurrent WebSocket connections and proxy tunnels. Never execute synchronous file operations (`readFileSync`, `writeFileSync`) in request handlers. Always use asynchronous streaming.

### 4. Machine Token Security
- Never log plain machine tokens (`ca_mach_...`) or JWT secret keys to stdout or production logs.
- Pending reverse pairing sessions expire after 10 minutes and are wiped from memory.

### 5. WebSocket Connection Cleanup
- Always unregister closed sockets from `daemonHub` and `clientHub` to prevent memory leaks and zombie references.

---

## 🛠️ Verification & Testing Commands

Before completing any task affecting `apps/gateway`, run:

```bash
# Typecheck gateway package
pnpm --filter @cloud-agent/gateway typecheck

# Build gateway package
pnpm --filter @cloud-agent/gateway build

# Start dev server
pnpm --filter @cloud-agent/gateway dev
```
