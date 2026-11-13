# Remove WebRTC and Complete Migration to Pure WebSocket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely remove WebRTC peer-to-peer implementation, signaling logic, and the heavy `werift` dependency across the monorepo, standardizing all communication between Mobile, Gateway, and Daemon on the battle-tested, zero-flakiness WebSocket relay.

**Architecture:** The Mobile client connects via authenticated WebSocket to the Gateway Hub (`/ws`), while the Daemon maintains an outbound WebSocket to the Gateway Hub (`/daemon/ws`). The Gateway routes JSON-RPC requests, streaming chunks (AI thought tokens, terminal ANSI streams), and tool approvals bi-directionally over these persistent sockets with sub-50ms latency, eliminating STUN/TURN, NAT traversal failures, and heavy WebRTC dependencies.

**Tech Stack:** TypeScript, Node.js WebSocket (`ws`), React Native WebSocket, pnpm monorepo.

**Spec:** [docs/superpowers/plans/2026-11-13-remove-webrtc-move-to-websocket.md](file:///D:/python/cloud-agent/docs/superpowers/plans/2026-11-13-remove-webrtc-move-to-websocket.md)

## Global Constraints

- **Explicit Git Commits Only (Golden Rule 1)**: Do NOT run `git commit` or `git push` autonomously. Only commit when explicitly prompted by the user.
- **Always Verify Builds & Types Before Completion (Golden Rule 2)**: Every task must typecheck cleanly via `pnpm --filter <pkg> typecheck` and monorepo tests must pass (`pnpm turbo test`).
- **Zero-DB Daemon Invariant (Golden Rule 3)**: `apps/daemon` must remain completely database-free.
- **Zero Inbound Ports on Daemon**: Daemon only connects outbound via WebSocket to Gateway Hub (`/daemon/ws`).
- **Public API Stability**: The client singleton exported from `apps/mobile/src/lib/p2p-client.ts` must maintain its full public interface (`connect`, `disconnect`, `sendRpc`, `onStateChange`, `onEvent`, `switchMachine`, `isConnected`) so zero consumer stores require refactoring.

## Review Focus

1. **RPC Promise Timeout & Rejection on Socket Closure**: If a WebSocket drops mid-flight while an `agent.run` turn or RPC is pending, pending RPC promises must reject with a descriptive connection error rather than hanging indefinitely.
2. **Streaming Deduplication**: Progressive stream chunks (e.g. streaming thought chunks and text chunks) must continue streaming without premature resolution of the pending RPC promise.
3. **Machine Switch State Reset**: When a user switches machines in the mobile drawer (`switchMachine`), the socket state and active pending queries must update cleanly without stale event leaks.
4. **Daemon Outbound Reconnection**: When the gateway restarts or network drops, daemon's exponential backoff reconnection must continue to reconnect automatically.
5. **Clean Dependency Pruning**: Removing `werift` must not break daemon or gateway compilation or leave phantom imports.

---

### Task 1: Remove WebRTC & `werift` Dependency from `apps/daemon`

**Files:**
- Delete: `apps/daemon/src/webrtc.ts`
- Modify: `apps/daemon/src/connection.ts`
- Modify: `apps/daemon/package.json`

**Interfaces:**
- Consumes: `rpcDispatcher.handle(req, onStreamChunk)` from `apps/daemon/src/rpc/index.ts`
- Produces: `GatewayConnection` class in `apps/daemon/src/connection.ts` managing outbound WebSocket to `/daemon/ws`

- [ ] **Step 1: Inspect and delete `apps/daemon/src/webrtc.ts`**

Remove `apps/daemon/src/webrtc.ts`, eliminating the `WebRtcPeerManager` class and pure-JS `werift` imports.

- [ ] **Step 2: Refactor `apps/daemon/src/connection.ts` to pure WebSocket**

1. Remove imports of `WebRtcPeerManager` and `SignalMessage` from `./webrtc.js`.
2. Remove `private webrtc: WebRtcPeerManager` property and its constructor initialization.
3. In `stop()`, remove `this.webrtc.closeAll()`.
4. In `this.ws.onmessage`, remove WebRTC signaling handlers:
   - `data.type === "webrtc.offer"`
   - `data.type === "webrtc.candidate"`
   - `data.type === "webrtc.close"`
5. Retain pure JSON-RPC message handling:
```typescript
const req: RpcRequest = data;
if (req.id && req.method) {
  const res = await rpcDispatcher.handle(req, (streamChunk) => {
    this.send(streamChunk);
  });
  this.send(res);
}
```

- [ ] **Step 3: Remove `werift` from `apps/daemon/package.json`**

Remove `"werift": "^0.25.2"` from `"dependencies"` in `apps/daemon/package.json`.

- [ ] **Step 4: Verify daemon typecheck and unit tests**

Run: `pnpm --filter @cloud-agent/daemon typecheck`
Expected: PASS with 0 errors.

Run: `pnpm --filter @cloud-agent/daemon test`
Expected: PASS (all 47 daemon tests pass).

---

### Task 2: Remove WebRTC Signaling Handlers from `apps/gateway`

**Files:**
- Modify: `apps/gateway/src/hub/client-hub.ts`
- Modify: `apps/gateway/src/hub/daemon-hub.ts`
- Delete: `apps/gateway/src/test-webrtc-e2e.ts`
- Modify: `apps/gateway/package.json`

**Interfaces:**
- Consumes: WebSocket frames from client (`/ws`) and daemon (`/daemon/ws`)
- Produces: `rpcRouter.route(user, req, onStreamChunk)` routing pure WebSocket JSON-RPC

- [ ] **Step 1: Clean WebRTC signaling from `apps/gateway/src/hub/client-hub.ts`**

In `apps/gateway/src/hub/client-hub.ts`, remove lines 60–89:
- Remove block `if (msg.type === "webrtc.offer" || msg.type === "webrtc.candidate") { ... }`.
- Client messages now handle:
  1. Heartbeat pings (`ping` / `heartbeat` -> respond `pong`).
  2. JSON-RPC requests (`req.id`, `req.method`) routed to `rpcRouter.route(...)`.

- [ ] **Step 2: Clean WebRTC signaling from `apps/gateway/src/hub/daemon-hub.ts`**

In `apps/gateway/src/hub/daemon-hub.ts`:
- Remove `sendSignalToDaemon(machineId, signal)` method (lines 100–107).
- In `handleDaemonMessage`, remove lines 113–118:
  - `if ((data.type === "webrtc.answer" || data.type === "webrtc.candidate") && data.clientId) { ... }`.
- Retain heartbeat, push notifications, and RPC streaming response routing.

- [ ] **Step 3: Delete `apps/gateway/src/test-webrtc-e2e.ts` and update `package.json`**

1. Delete file `apps/gateway/src/test-webrtc-e2e.ts`.
2. In `apps/gateway/package.json`:
   - Remove `"test:webrtc": "tsx src/test-webrtc-e2e.ts"` from `"scripts"`.
   - Remove `"werift": "^0.25.2"` from `"devDependencies"`.

- [ ] **Step 4: Verify gateway typecheck**

Run: `pnpm --filter @cloud-agent/gateway typecheck`
Expected: PASS with 0 errors.

---

### Task 3: Refactor `apps/mobile/src/lib/p2p-client.ts` to Pure WebSocket Client

**Files:**
- Modify: `apps/mobile/src/lib/p2p-client.ts`
- Modify: `apps/mobile/src/App.tsx`
- Modify: `apps/mobile/src/components/ServerSettingsModal.tsx`

**Interfaces:**
- Consumes: WebSocket connection to `gatewayUrl/ws`
- Produces: `MobileP2PClient` singleton maintaining full backward-compatible public API (`connect`, `disconnect`, `sendRpc`, `onStateChange`, `onEvent`, `switchMachine`, `isConnected`, `getState`)

- [ ] **Step 1: Refactor `MobileP2PClient` in `apps/mobile/src/lib/p2p-client.ts`**

1. Remove WebRTC properties:
   - `private pc: any | null = null;`
   - `private dc: any | null = null;`
2. In `connect()`:
   - Remove `RTCPeerConnection` instantiation, `createDataChannel`, `onicecandidate`, `onopen`, and `onmessage` on `dc`.
   - On `this.ws.onmessage`:
     - Keep `client.ready` -> set `this.clientId = data.clientId; this.setState('connected');`.
     - Remove `webrtc.answer` and `webrtc.candidate` branches.
     - Call `this.handleIncomingMessage(rawText)`.
3. In `sendRpc()`:
   - Always send directly via `this.ws.send(payload)`.
   - Remove `this.dc` branching.
4. In `switchMachine(newMachineId)`:
   - Remove `this.pc?.close()`, `this.dc?.close()`, and WebRTC re-negotiation.
   - Simply update `this.machineId = newMachineId;`.
5. In `disconnect()`:
   - Remove `this.dc?.close()`, `this.pc?.close()`.

- [ ] **Step 2: Update UI and comments in `apps/mobile`**

1. In `apps/mobile/src/App.tsx` line 115:
   - Update comment from `// If connected via WebRTC, also trigger store handler` to `// If connected, also trigger store handler`.
2. In `apps/mobile/src/components/ServerSettingsModal.tsx` line 367:
   - Update description to: `Routes WebSocket communication, live terminal streams, tool approvals, and physical push alerts to your device.`

- [ ] **Step 3: Verify mobile typecheck**

Run: `pnpm --filter @cloud-agent/mobile typecheck`
Expected: PASS with 0 errors.

---

### Task 4: Prune Monorepo Dependencies, Update Docs, and Full Test Suite Verification

**Files:**
- Modify: `package.json` / `pnpm-lock.yaml`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `apps/daemon/README.md`

- [ ] **Step 1: Prune root dependencies and update pnpm lockfile**

Run: `pnpm install`
Expected: Successfully prune `werift` from `node_modules` across `apps/daemon` and `apps/gateway`.

- [ ] **Step 2: Update networking conventions in `AGENTS.md`**

Update section `## 🌐 WebRTC P2P & Networking Conventions` to `## 🌐 Networking & WebSocket Conventions`:
- Document pure outbound WebSocket relay architecture (`/daemon/ws` and `/ws`).
- Confirm zero inbound ports on daemon invariant.
- Confirm 0.0.0.0 bind rule and dynamic host resolution.

- [ ] **Step 3: Update `README.md` and `apps/daemon/README.md`**

Remove references to WebRTC DataChannel, noting the high-throughput, low-latency WebSocket relay hub architecture.

- [ ] **Step 4: Run full verification suite**

Run:
1. `pnpm --filter @cloud-agent/daemon typecheck`
2. `pnpm --filter @cloud-agent/gateway typecheck`
3. `pnpm --filter @cloud-agent/mobile typecheck`
4. `pnpm --filter @cloud-agent/cli-antigravity typecheck`
5. `pnpm turbo test`
Expected: All 57+ tests PASS across all packages.
