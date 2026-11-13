# Design Specification: Remote Process & Node Manager

**Date:** 2026-11-13  
**Status:** Approved for Implementation  
**Target Packages:** `apps/daemon`, `packages/cli-interface`, `packages/cli/antigravity`, `apps/mobile`

---

## 1. Intent & Context

The Cloud Agent platform allows operators to instruct autonomous coding agents running on remote hosts directly from a mobile device. While the daemon and CLI workers execute as persistent headless background processes to eliminate cold-start latency, mobile users currently lack remote visibility into and direct control over:
1. **The Daemon Service**: PID, host uptime, memory usage, CPU load, and daemon log diagnostics, with no way to restart or stop the daemon without SSH.
2. **Warm Persistent CLI Workers**: Background `PersistentWorker` child processes spooled by the CLI adapter (`agy`) to keep session state warm. Users cannot inspect active worker PIDs, their session/workspace associations, memory footprint, or terminate/restart hung workers.

This feature introduces a comprehensive **Remote Process & Node Manager** accessible directly from the mobile app, providing complete lifecycle control over the host daemon and coding-agent worker pool.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- **Daemon Lifecycle Management**:
  - Expose host daemon service health: PID, platform/arch, Node.js runtime version, uptime, RAM consumption with percentage visual gauge, and CPU load.
  - Safe remote triggers: **Restart Daemon** (gracefully restarts service on the host while signaling mobile to auto-reconnect) and **Stop Daemon**.
  - Remote log inspection: Fetch and tail the last 100-200 lines of `~/.cloud-agent/daemon.log` on demand.
- **Persistent CLI Worker Management**:
  - Discover and list all warm persistent CLI worker child processes running under the active CLI adapter.
  - Display worker metadata: PID, associated Session ID and Session Title, Workspace directory, active Model & Reasoning Effort, Status (`Idle / Ready` vs `Busy / Turn Running`), and uptime.
  - Targeted controls: **Kill Worker** (reclaims RAM; clean worker re-spools automatically on next prompt), **Restart Worker**, and global **Kill All Idle Workers**.
- **PanelUI-Native Mobile Interface**:
  - Cohesive, tactile `panelui-native` bottom sheet (`ProcessManagerSheet.tsx`) conforming to PanelUI Dark, Light, and Swiss Minimalist design tokens.
  - Mount access points in [SidebarDrawer.tsx](file:///D:/python/cloud-agent/apps/mobile/src/components/SidebarDrawer.tsx) under "Management & Tools" and in the header 3-dots action menu of [AgentTurnScreen.tsx](file:///D:/python/cloud-agent/apps/mobile/src/screens/AgentTurnScreen.tsx).
  - Also wire the real daemon restart trigger inside [MachineHealthScreen.tsx](file:///D:/python/cloud-agent/apps/mobile/src/screens/MachineHealthScreen.tsx).

### Non-Goals
- **Arbitrary OS Task Manager**: We are not building a generic `htop` / `top` tool for all host OS processes. Scope is strictly limited to Cloud Agent Daemon and its coding-agent CLI worker child processes.
- **Manual Worker Spawning via UI**: Workers are spooled automatically when turns execute for a session.

### Anti-Goals
- **No Database Persistence in Daemon**: Strictly enforce the **Zero-DB Daemon Invariant**. All process introspection uses in-memory worker maps and host OS APIs (`process`, `os`).
- **No Hanging Client Streams on Worker Kill**: If a busy worker is killed or restarted while executing an active turn, the turn stream must be cleanly terminated immediately so mobile does not freeze.

---

## 3. Approaches Considered & Selected

- **Approach A (Selected — Dedicated Sheet in Sidebar & Chat Header)**:
  - Accessible via Sidebar Drawer "Management & Tools" and the Chat Header 3-dots menu.
  - Two segmented views (`[ Daemon Service | Active Workers (N) ]`).
  - Keeps the operator inside their active workflow without leaving the Chat screen.
  - Wires up the existing placeholder button in `MachineHealthScreen.tsx` as well.
- **Approach B (Full Navigation Screen Only)**:
  - Add a separate full screen route.
  - *Tradeoff*: Pulls the user entirely out of conversation context; rejected in favor of Approach A.

---

## 4. Architecture & Technical Specification

### 4.1 CLI Interface Contract (`packages/cli-interface`)

In [types.ts](file:///D:/python/cloud-agent/packages/cli-interface/src/types.ts) and [adapter.ts](file:///D:/python/cloud-agent/packages/cli-interface/src/adapter.ts):

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

export interface ICliAdapter {
  // Existing methods...
  listWorkers?(): Promise<CliWorkerInfo[]>;
  killWorker?(sessionId: string): Promise<boolean>;
  restartWorker?(sessionId: string): Promise<boolean>;
  killAllIdleWorkers?(): Promise<number>;
}
```

### 4.2 Antigravity CLI Adapter Implementation (`packages/cli/antigravity`)

In [stream-client.ts](file:///D:/python/cloud-agent/packages/cli/antigravity/src/stream-client.ts):
- Extend `PersistentWorker`:
  - `readonly pid?: number` (assigned from `this.child.pid`)
  - `readonly startedAt: string` (timestamp of instantiation)
  - `lastActiveAt: string` (updated whenever a turn starts/completes)
- Implement `listWorkers()` on `AntigravityStreamClient`:
  - Iterates over `this.workers`.
  - Resolves session title and workspace name from session meta/cache.
  - Returns `CliWorkerInfo[]`.
- Implement `killWorker(sessionId)`:
  - If `worker.isBusy`:
    - Broadcasts synthetic status error event to active stream.
    - Resolves in-flight RPC via stream hub endTurn.
  - Calls `worker.destroy()`, deletes from `this.workers`.
  - Returns `true`.
- Implement `restartWorker(sessionId)`:
  - Calls `killWorker(sessionId)`.
  - Immediately spools fresh `PersistentWorker` with identical configuration ready for next turn.
- Implement `killAllIdleWorkers()`:
  - Iterates `this.workers`, terminates all workers where `!worker.isBusy`.
  - Returns number of killed workers.

### 4.3 Daemon Process Supervision & Self-Restart Model (`apps/daemon`)

In [service.ts](file:///D:/python/cloud-agent/apps/daemon/src/service.ts) and [rpc/index.ts](file:///D:/python/cloud-agent/apps/daemon/src/rpc/index.ts):

- **Self-Restart Strategy**:
  - `restartService(isSelfRestart = false)`:
    - **Linux (systemd)**: Runs `systemctl --user restart cloud-agent.service`.
    - **macOS (launchd)**: Runs `launchctl kickstart -k gui/$(id -u)/com.cloudagent.daemon` or reload.
    - **Universal Detached Runner (Windows & Standalone Node)**:
      Spawns successor detached process before exiting current process:
      ```ts
      const execCmd = getExecutionCommand();
      const child = spawn(execCmd.cmd, execCmd.args, {
        detached: true,
        stdio: "ignore",
        cwd: os.homedir(),
        env: { ...process.env, NODE_ENV: "production" },
      });
      child.unref();
      // Unlink current PID and exit cleanly
      removePid();
      process.exit(0);
      ```
  - In `rpc/index.ts`, `case "daemon.restart"`:
    - Responds immediately with `{ ok: true, message: "Restarting daemon service..." }`.
    - Dispatches restart after 350ms delay:
      ```ts
      setTimeout(async () => {
        await restartService(true);
      }, 350);
      ```
- **RPC Handlers in `RpcDispatcher`**:
  - `daemon.workers`: Invokes `adapter.listWorkers()` -> `{ workers: CliWorkerInfo[] }`.
  - `daemon.kill_worker`: `{ sessionId: string }` -> invokes `adapter.killWorker(sessionId)` -> `{ ok: boolean }`.
  - `daemon.restart_worker`: `{ sessionId: string }` -> invokes `adapter.restartWorker(sessionId)` -> `{ ok: boolean }`.
  - `daemon.kill_all_workers`: Invokes `adapter.killAllIdleWorkers()` -> `{ count: number }`.
  - `daemon.logs`: `{ lines?: number }` (default: 100) -> reads `getLogFilePath()`, returns `{ lines: string[], path: string }`.
  - `daemon.restart`: Schedules graceful restart -> `{ ok: true }`.
  - `daemon.stop`: Schedules `stopService()` -> `{ ok: true }`.

### 4.4 Mobile State Management (`apps/mobile/src/stores/useDaemonStore.ts`)

Add state and actions to `useDaemonStore`:
- **State**:
  - `cliWorkers: CliWorkerInfo[]`
  - `isLoadingWorkers: boolean`
  - `isRestartingDaemon: boolean`
  - `daemonLogLines: string[]`
  - `isLoadingDaemonLogs: boolean`
- **Actions**:
  - `fetchCliWorkers: () => Promise<void>`
  - `killCliWorker: (sessionId: string) => Promise<boolean>`
  - `restartCliWorker: (sessionId: string) => Promise<boolean>`
  - `killAllIdleCliWorkers: () => Promise<number>`
  - `restartDaemonService: () => Promise<boolean>`
  - `stopDaemonService: () => Promise<boolean>`
  - `fetchDaemonLogs: (lines?: number) => Promise<void>`

### 4.5 Mobile UI Component (`apps/mobile/src/components/ProcessManagerSheet.tsx`)

A `panelui-native` full-height bottom sheet:
- `<BottomSheet size="full">` with header and tab switcher (`[ Daemon Service | Active Workers (N) ]`):
  - **Tab 1: Daemon Service**:
    - Host KPI card: Hostname, Platform, Node version, Daemon PID, Uptime.
    - Resource Gauge: RAM used / total with percentage `Progress` bar, CPU load metric with core count.
    - Lifecycle Buttons: `Restart Daemon` (with confirmation alert), `Stop Daemon`.
    - Logs Card: Collapsible live log viewer displaying tail of `daemon.log` with refresh button.
  - **Tab 2: Coding Agent CLI Workers**:
    - Header Action: `Kill All Idle Workers` button with badge count.
    - List of warm persistent CLI workers:
      - Header row: Worker PID, Session Name/ID, Workspace name.
      - Meta row: Model badge, Reasoning effort badge, Status pill (green `Idle (Ready)` / amber `Executing Turn`).
      - Action buttons: `Kill Worker`, `Restart Worker`.
    - Empty state when 0 workers are spooled.

### 4.6 Navigation Integration
- In [SidebarDrawer.tsx](file:///D:/python/cloud-agent/apps/mobile/src/components/SidebarDrawer.tsx): Add "Process & Daemon Control" item under "Management & Tools" with an `Activity` / `Cpu` icon.
- In [AgentTurnScreen.tsx](file:///D:/python/cloud-agent/apps/mobile/src/screens/AgentTurnScreen.tsx): Add "Process & Daemon Manager" to the header 3-dots action dropdown menu.
- In [MachineHealthScreen.tsx](file:///D:/python/cloud-agent/apps/mobile/src/screens/MachineHealthScreen.tsx): Connect the existing "Restart Daemon" button to `restartDaemonService()` and display active worker count.

---

## 5. Verification & Test Plan

1. **Unit & Integration Tests**:
   - Test `CliAdapter` worker discovery and worker termination in `packages/cli/antigravity`.
   - Test daemon RPC dispatcher for `daemon.workers`, `daemon.kill_worker`, `daemon.restart_worker`, `daemon.kill_all_workers`, `daemon.logs`, and `daemon.restart` in `apps/daemon/test/rpc-handlers.test.ts`.
2. **Typecheck & Lint**:
   - `pnpm --filter @cloud-agent/cli-interface typecheck`
   - `pnpm --filter @cloud-agent/cli-antigravity typecheck`
   - `pnpm --filter @cloud-agent/daemon typecheck`
   - `pnpm --filter @cloud-agent/mobile typecheck`
3. **End-to-End Monorepo Tests**:
   - Run `pnpm test` across all monorepo packages.
