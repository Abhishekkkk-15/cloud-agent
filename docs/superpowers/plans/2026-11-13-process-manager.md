# Remote Process & Node Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide full mobile visibility and remote lifecycle control over the host Daemon service (PID, RAM, CPU, logs, restart, stop) and warm persistent CLI coding-agent workers (PID, session, status, kill, restart, kill all idle).

**Architecture:** Extend the CLI interface and Antigravity adapter with worker lifecycle introspection and termination hooks. Introduce corresponding RPC endpoints and a platform-aware detached self-restart mechanism in the Daemon. Expose these capabilities through a mobile Zustand store and a full-height `panelui-native` bottom sheet accessible from both the Sidebar Drawer and the Chat Header action menu.

**Tech Stack:** Node.js child_process, TypeScript, Vitest/Node:test, React Native (Expo), `panelui-native`, Zustand, Tailwind CSS v4 / Uniwind.

**Spec:** [docs/superpowers/specs/2026-11-13-process-manager-design.md](file:///D:/python/cloud-agent/docs/superpowers/specs/2026-11-13-process-manager-design.md)

---

## Global Constraints

- **Explicit Git Commits Only**: Do not commit or push without explicit user request.
- **Zero-DB Daemon Invariant**: `apps/daemon` must remain 100% database-free; all process introspection uses in-memory worker maps and host OS APIs (`process`, `os`, `fs`).
- **PanelUI-Native Component-First Invariant (`apps/mobile`)**: All UI elements in `apps/mobile` must strictly use `panelui-native` primitives (`BottomSheet`, `Button`, `Progress`, `Badge`, `Card`, `Item`, `Text`) with Tailwind utility classes.
- **Warm Persistent Process Invariant**: Do not spawn temporary CLI processes for introspection; introspect the existing in-memory pool of `PersistentWorker` instances.
- **Clickable File Links**: Always use `file:///` forward-slash links in responses and documentation.

---

## Review Focus

1. **Busy Worker Termination Mid-Turn**: Killing or restarting an active worker executing a prompt (`isBusy: true`) must immediately emit a synthetic error event and cleanly end the stream in `sessionStreamHub` so the mobile client never hangs waiting for a timeout.
2. **Daemon Self-Restart Process Severance on Windows/Standalone**: Daemon self-restart must spawn the successor detached process first, save the new PID, and exit cleanly without killing the parent before the child takes over.
3. **Daemon Log File Missing / Empty**: `daemon.logs` RPC requested when `~/.cloud-agent/daemon.log` does not exist or has fewer lines than requested must safely return `{ lines: [], path }` without ENOENT exceptions.
4. **Worker List Introspection with Dead Process**: When a worker process exits abruptly, `listWorkers()` must filter or report accurately without crashing on missing PIDs.
5. **Kill All Idle Workers Edge Case**: When 0 idle workers are present (or all are busy), `killAllIdleWorkers()` must return `0` cleanly without disrupting busy workers.

---

## Tasks

### Task 1: CLI Interface Contracts (`packages/cli-interface`)

**Files:**
- Modify: `packages/cli-interface/src/types.ts`
- Modify: `packages/cli-interface/src/adapter.ts`
- Test: `packages/cli-interface/test/worker-interface.test.ts`

**Interfaces:**
- Consumes: Existing `ICliAdapter`, `BaseCliAdapter`
- Produces:
  ```ts
  export interface CliWorkerInfo {
    sessionId: string;
    sessionTitle?: string;
    workspacePath?: string;
    workspaceName?: string;
    pid?: number;
    isRunning: boolean;
    isBusy: boolean;
    activeModel?: string;
    activeEffort?: string;
    activeMode?: string;
    activeCwd?: string;
    startedAt: string;
    lastActiveAt: string;
  }
  ```
  On `ICliAdapter`:
  ```ts
  listWorkers?(): Promise<CliWorkerInfo[]>;
  killWorker?(sessionId: string): Promise<boolean>;
  restartWorker?(sessionId: string): Promise<boolean>;
  killAllIdleWorkers?(): Promise<number>;
  ```

- [ ] **Step 1: Write test for worker interface definitions**
  Create `packages/cli-interface/test/worker-interface.test.ts` verifying `BaseCliAdapter` provides default implementations for `listWorkers`, `killWorker`, `restartWorker`, and `killAllIdleWorkers`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --filter @cloud-agent/cli-interface test`
  Expected: FAIL with missing properties on `BaseCliAdapter`.

- [ ] **Step 3: Implement `CliWorkerInfo` and default methods on `BaseCliAdapter`**
  Add `CliWorkerInfo` to `types.ts`. Add optional methods to `ICliAdapter` and default stubs returning empty arrays or false to `BaseCliAdapter` in `adapter.ts`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm --filter @cloud-agent/cli-interface test`
  Expected: PASS. Verify with `pnpm --filter @cloud-agent/cli-interface typecheck`.

---

### Task 2: Worker Tracking & Management in Antigravity Adapter (`packages/cli/antigravity`)

**Files:**
- Modify: `packages/cli/antigravity/src/stream-client.ts`
- Modify: `packages/cli/antigravity/src/adapter.ts`
- Test: `packages/cli/antigravity/test/antigravity-workers.test.ts`

**Interfaces:**
- Consumes: `CliWorkerInfo`, `ICliAdapter` from `@cloud-agent/cli-interface`
- Produces:
  - `PersistentWorker.pid`: getter returning child PID
  - `PersistentWorker.startedAt`: ISO timestamp string
  - `PersistentWorker.lastActiveAt`: ISO timestamp string
  - `PersistentWorker.getWorkerInfo()`: returns `CliWorkerInfo`
  - `AntigravityStreamClient.listWorkers()`: returns `Promise<CliWorkerInfo[]>`
  - `AntigravityStreamClient.killWorker(sessionId: string)`: returns `boolean`
  - `AntigravityStreamClient.restartWorker(sessionId: string)`: returns `Promise<boolean>`
  - `AntigravityStreamClient.killAllIdleWorkers()`: returns `number`
  - `AntigravityCliAdapter`: implements `listWorkers`, `killWorker`, `restartWorker`, `killAllIdleWorkers`

- [ ] **Step 1: Write unit tests for worker tracking, listing, and lifecycle actions**
  Create `packages/cli/antigravity/test/antigravity-workers.test.ts`. Test:
  - Introspecting empty workers returns `[]`.
  - Simulating an active worker returns correct PID, session ID, timestamps, and model.
  - `killWorker` terminates the target worker.
  - `killAllIdleWorkers` terminates only idle workers, leaving busy workers untouched (addresses Review Focus 5).
  - Dead worker handling during introspection (addresses Review Focus 4).

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --filter @cloud-agent/cli-antigravity test`
  Expected: FAIL with `listWorkers is not a function`.

- [ ] **Step 3: Implement worker tracking and controls in `stream-client.ts` and `adapter.ts`**
  - In `PersistentWorker`: store `readonly startedAt = new Date().toISOString()`, update `lastActiveAt` on turn start/end, expose `get pid()`, expose `getWorkerInfo()`.
  - In `AntigravityStreamClient`: implement `listWorkers()`, `killWorker(sessionId)`, `restartWorker(sessionId)`, `killAllIdleWorkers()`.
  - In `AntigravityCliAdapter`: wire methods delegating to `this.client`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm --filter @cloud-agent/cli-antigravity test`
  Expected: PASS. Verify with `pnpm --filter @cloud-agent/cli-antigravity typecheck`.

---

### Task 3: Daemon Process Supervision, Self-Restart, & RPC Dispatcher (`apps/daemon`)

**Files:**
- Modify: `apps/daemon/src/service.ts`
- Modify: `apps/daemon/src/rpc/index.ts`
- Test: `apps/daemon/test/rpc-process-manager.test.ts`

**Interfaces:**
- Consumes: `listWorkers`, `killWorker`, `restartWorker`, `killAllIdleWorkers` from CLI adapter; `sessionStreamHub`
- Produces:
  - RPC methods: `daemon.workers`, `daemon.kill_worker`, `daemon.restart_worker`, `daemon.kill_all_workers`, `daemon.logs`, `daemon.restart`, `daemon.stop`
  - `restartService(isSelfRestart?: boolean)` with platform-aware detached successor spawning on Windows/standalone and systemctl/launchctl on Linux/macOS.

- [ ] **Step 1: Write unit tests for RPC handlers and failure modes**
  Create `apps/daemon/test/rpc-process-manager.test.ts`. Test:
  - `daemon.workers` returns array of workers from adapter.
  - `daemon.kill_worker` with valid sessionId terminates worker and cleans up stream if busy (addresses Review Focus 1).
  - `daemon.kill_all_workers` returns count of killed workers.
  - `daemon.logs` returns log lines gracefully even when log file is missing (addresses Review Focus 3).
  - `daemon.restart` responds `{ ok: true }` and schedules restart without immediate synchronous exit.

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --filter @cloud-agent/daemon test`
  Expected: FAIL with `Method not found: daemon.workers`.

- [ ] **Step 3: Implement `restartService(isSelfRestart)` and RPC methods in `apps/daemon`**
  - In `apps/daemon/src/service.ts`: Update `restartService(isSelfRestart = false)` to spawn detached child before unlinking/exiting on Windows (addresses Review Focus 2).
  - In `apps/daemon/src/rpc/index.ts`: Add cases for `daemon.workers`, `daemon.kill_worker`, `daemon.restart_worker`, `daemon.kill_all_workers`, `daemon.logs`, `daemon.restart`, `daemon.stop`.
  - In `daemon.kill_worker`: If turn is active in `sessionStreamHub`, emit synthetic error event and call `sessionStreamHub.endTurn(sessionId)` before killing (addresses Review Focus 1).

- [ ] **Step 4: Run test to verify it passes**
  Run: `pnpm --filter @cloud-agent/daemon test`
  Expected: PASS. Verify with `pnpm --filter @cloud-agent/daemon typecheck`.

---

### Task 4: Mobile Store Actions & Telemetry State (`apps/mobile`)

**Files:**
- Modify: `apps/mobile/src/stores/useDaemonStore.ts`
- Test: `pnpm --filter @cloud-agent/mobile typecheck`

**Interfaces:**
- Consumes: RPC methods from `apps/daemon`
- Produces:
  - Store state: `cliWorkers`, `isLoadingWorkers`, `isRestartingDaemon`, `daemonLogLines`, `isLoadingDaemonLogs`
  - Store actions: `fetchCliWorkers`, `killCliWorker`, `restartCliWorker`, `killAllIdleCliWorkers`, `restartDaemonService`, `stopDaemonService`, `fetchDaemonLogs`

- [ ] **Step 1: Add types and state properties to `useDaemonStore.ts`**
  Import `CliWorkerInfo` from `@cloud-agent/cli-interface`. Define state fields and initialize default values.

- [ ] **Step 2: Implement actions using `mobileP2P.sendRpc`**
  Implement `fetchCliWorkers()`, `killCliWorker(sessionId)`, `restartCliWorker(sessionId)`, `killAllIdleCliWorkers()`, `restartDaemonService()`, `stopDaemonService()`, `fetchDaemonLogs(lines)`.

- [ ] **Step 3: Run typecheck to verify mobile store compilation**
  Run: `pnpm --filter @cloud-agent/mobile typecheck`
  Expected: PASS.

---

### Task 5: Mobile UI Component (`apps/mobile/src/components/ProcessManagerSheet.tsx`)

**Files:**
- Create: `apps/mobile/src/components/ProcessManagerSheet.tsx`
- Test: `pnpm --filter @cloud-agent/mobile typecheck`

**Interfaces:**
- Consumes: `useDaemonStore` (`cliWorkers`, `daemonStatus`, `fetchCliWorkers`, `killCliWorker`, `restartCliWorker`, `killAllIdleCliWorkers`, `restartDaemonService`, `stopDaemonService`, `fetchDaemonLogs`, etc.)
- Produces:
  - `<ProcessManagerSheet isOpen={boolean} onClose={() => void} initialTab?: 'daemon' | 'workers' />`

- [ ] **Step 1: Build `ProcessManagerSheet.tsx` with `panelui-native` components**
  - Full-height `<BottomSheet open={isOpen} onOpenChange={...}>`.
  - Header with title "Process & Node Manager" and auto-refresh button.
  - Tab selector: `[ Daemon Service | Active Workers (${count}) ]`.
  - **Daemon Tab**:
    - Host KPI card: Hostname, platform, PID, Node runtime version, uptime.
    - Resource gauge: RAM used/total with `Progress` bar, CPU load percentage with cores.
    - Control buttons: Restart Daemon (with native Alert confirmation), Stop Daemon.
    - Live logs terminal card: Collapsible log viewer displaying tail of `daemon.log` with refresh button.
  - **Workers Tab**:
    - Top bar: `Kill All Idle Workers` button with idle badge.
    - Worker cards: PID, Session title, workspace directory, model/effort pill, status badge (green `Idle (Ready)` vs amber `Executing Turn`), and individual `Kill` and `Restart` buttons.
    - Empty state when 0 workers are spooled.

- [ ] **Step 2: Run typecheck to verify UI component syntax and styling**
  Run: `pnpm --filter @cloud-agent/mobile typecheck`
  Expected: PASS.

---

### Task 6: Mobile Screen Integration (`SidebarDrawer.tsx`, `AgentTurnScreen.tsx`, `MachineHealthScreen.tsx`)

**Files:**
- Modify: `apps/mobile/src/components/SidebarDrawer.tsx`
- Modify: `apps/mobile/src/screens/AgentTurnScreen.tsx`
- Modify: `apps/mobile/src/screens/MachineHealthScreen.tsx`
- Test: `pnpm --filter @cloud-agent/mobile typecheck`

**Interfaces:**
- Consumes: `<ProcessManagerSheet />`
- Produces: Entry points in navigation drawer, chat header 3-dots menu, and machine health screen.

- [ ] **Step 1: Wire `ProcessManagerSheet` into `SidebarDrawer.tsx`**
  Under "Management & Tools", add "Process & Daemon Manager" with `Cpu` icon. Clicking it opens the sheet.

- [ ] **Step 2: Wire `ProcessManagerSheet` into `AgentTurnScreen.tsx`**
  In the header 3-dots action menu, add "Process & Node Manager" item. Clicking it opens the sheet.

- [ ] **Step 3: Connect real restart and logs in `MachineHealthScreen.tsx`**
  Replace placeholder toast with `restartDaemonService()`, and wire "Daemon Logs" button to open `ProcessManagerSheet` on the Daemon tab.

- [ ] **Step 4: Run typecheck to verify screen integration**
  Run: `pnpm --filter @cloud-agent/mobile typecheck`
  Expected: PASS.

---

### Task 7: Monorepo Verification & Test Suite Execution

**Files:**
- None (verification only)

- [ ] **Step 1: Run typechecks across all monorepo packages**
  Run:
  - `pnpm --filter @cloud-agent/cli-interface typecheck`
  - `pnpm --filter @cloud-agent/cli-antigravity typecheck`
  - `pnpm --filter @cloud-agent/daemon typecheck`
  - `pnpm --filter @cloud-agent/mobile typecheck`
  Expected: All typechecks pass with 0 errors.

- [ ] **Step 2: Run complete test suite across monorepo**
  Run: `pnpm test`
  Expected: All tests pass.

- [ ] **Step 3: User verification and push readiness**
  Present summary and confirm commit & push readiness per Golden Rule 1.
