# AGENTS.md — Developer & Autonomous Agent Guidelines

This document provides development instructions, operational rules, code style standards, and safety boundaries for all autonomous AI agents and human engineers contributing to the **Cloud Agent** platform.

---

## 📜 Golden Rules of Engagement

1. **Explicit Git Commits Only**:
   - **NEVER** run `git commit` or `git push` autonomously.
   - Only execute git staging, committing, and pushing when the user explicitly requests it in their prompt (e.g., "commit and push").
   - Commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
     `feat(scope): message`, `fix(scope): message`, `chore(scope): message`.

2. **Always Verify Builds & Types Before Completion**:
   - Run typecheck or build commands on affected packages before declaring any task done:
     - Root build: `pnpm build`
     - Mobile typecheck: `pnpm --filter @cloud-agent/mobile typecheck`
     - Daemon typecheck: `pnpm --filter @cloud-agent/daemon typecheck`
     - CLI adapter typecheck: `pnpm --filter @cloud-agent/cli-antigravity typecheck`

3. **Zero-DB Daemon Invariant**:
   - `apps/daemon` must remain completely database-free.
   - **NEVER** install or introduce MongoDB, SQLite, PostgreSQL, Prisma, TypeORM, or any external database engine into `apps/daemon`.
   - Read transcripts directly from disk using line-by-line NDJSON streams.

4. **Headless Execution & Permissions**:
   - CLI adapters must run non-interactively.
   - Always ensure permission bypass flags are set (e.g., `--dangerously-skip-permissions` in `packages/cli/antigravity`) so that headless daemon processes never hang waiting for interactive TTY prompt inputs (`[y/n]`).

5. **Warm Persistent Process Pool Invariant**:
   - Do **NOT** spawn a new CLI process per chat turn. Re-reading transcripts from disk introduces 10+ second latency.
   - Always maintain a persistent worker with an open `stdin` pipe for active sessions and feed user messages via NDJSON stream.

6. **Zero-Mock & Clean Agent UI Invariant**:
   - All UI components (chat sessions, turns, tool execution trays, machine health, and approvals) must render dynamic data from daemon and gateway streams only.
   - **NEVER** introduce hardcoded fallback turns, fake pull request or merge conflict simulations, fake user usernames (e.g. `@Abhishekkk-15 commented:`), fake credits, or hardcoded machine hostnames (e.g. `DESKTOP-...`).
   - Remove GitHub PR UI artifacts ("commit", "merge", floating "VIEW PR" buttons).

---

## 🎨 UI & Styling Standards (Black, White, Gray & #0077b6)

When working on `apps/mobile` or client UI components:
- Strictly adhere to the **Black, White, Gray, and `#0077b6`** palette:
  - **Canvas Background**: `#0d1117`
  - **Canvas Inset**: `#010409`
  - **Card / Surface**: `#161b22`
  - **Borders & Dividers**: `#21262d` (subtle) / `#30363d` (card boundaries)
  - **Hover / Inset**: `#21262d`
  - **Primary Text**: `#f0f6fc`
  - **Secondary Text**: `#c9d1d9`
  - **Muted Text**: `#8b949e` / `#6e7681`
  - **Pacific Azure Blue (Primary Accent)**: `#0077b6` (primary buttons / active highlights), `#0096c7` / `#48cae4` (light accent text / highlights), `rgba(0, 119, 182, 0.15)` (subtle pill/active item bg), `rgba(0, 119, 182, 0.35)` (subtle border)
  - **Chat Panel Tool Icons**: Use clean white (`#ffffff` / `#f0f6fc`) for all tool category icons (shell, file, repo, mcp, search) in chat panels and slide trays.
  - **Danger Red (Exceptions / Alerts only)**: `#f85149` (text/icons), `#da3633` (bg)
- **Navigation & Layout Conventions**:
  - **Default Screen**: App opens by default on the Chat screen (`AgentTurnScreen`) with the previously/last opened session auto-selected.
  - **No Bottom Navbar**: Navigation is driven by a swipeable sidebar drawer (`SidebarDrawer.tsx`) accessible via left-edge swipe or tapping the circular `<` header button.
  - **Header Bar**: Features a circular 36x36 dark gray button with `<` icon beside the clean session title.
  - **Chat Input Bar**: Capsule pill-shaped container (`borderRadius: 28`) with an embedded circular `+` button on the left, "Type a message..." placeholder, and send / microphone action on the right.
- Use Lucide icons wrapped via [`apps/mobile/src/components/Icons.tsx`](file:///mnt/dev/projects/cloud-agent/apps/mobile/src/components/Icons.tsx).
- Ensure all agent tool outputs (e.g. `read_file`, `run_command`, `json`) are rendered cleanly through [`apps/mobile/src/components/MarkdownText.tsx`](file:///mnt/dev/projects/cloud-agent/apps/mobile/src/components/MarkdownText.tsx).

---

## 🌐 WebRTC P2P & Networking Conventions

- **Zero Inbound Ports on Daemon**: Never add listening HTTP or socket servers to the Daemon. The daemon only dials outbound to the Gateway Hub (`/daemon/ws`).
- **0.0.0.0 Server Bind Rule**: Always bind backend services (`apps/api` on `:8000`, `apps/gateway` on `:8080`) to `0.0.0.0`, **never** `127.0.0.1`. Binding to `127.0.0.1` restricts traffic to loopback and causes `ConnectException` when mobile clients (Expo Go) connect over local Wi-Fi.
- **Dynamic Host Resolution in Mobile**: Never hardcode `127.0.0.1` or `localhost` in `apps/mobile` store URLs. On Android and iOS devices, `127.0.0.1` refers to the device itself. Always extract the host dynamically from `NativeModules.SourceCode.scriptURL` with fallbacks for web (`window.location.hostname`).
- **Metro Monorepo & Pnpm Compatibility**:
  - Always keep `watchFolders` configured with `monorepoRoot` and external CLI package paths in `apps/mobile/metro.config.js` to prevent `Failed to get the SHA-1` errors.
  - Due to pnpm's strict package isolation, peer/runtime packages required by React Native (e.g., `@react-native/assets-registry` for `react-native-svg`) must be explicitly declared in `apps/mobile/package.json`.
- **RPC Timeouts**:
  - Query RPCs (`daemon.status`, `sessions.list`, `sessions.messages`): **30 seconds**.
  - Long-running execution RPCs (`agent.run`): **180 seconds** minimum.
- **Streaming Chunks**:
  - Always distinguish between streaming event chunks and final turn results.
  - Intermediate stream chunks (`stream: true`) must update state progressively without prematurely resolving or rejecting pending RPC promises.

---

## 🛠️ Monorepo Operations

### Package Execution
Always target packages via pnpm filters:
```bash
# Typecheck mobile
pnpm --filter @cloud-agent/mobile typecheck

# Typecheck daemon
pnpm --filter @cloud-agent/daemon typecheck

# Start dev server for a specific package
pnpm --filter @cloud-agent/gateway dev
pnpm --filter @cloud-agent/daemon dev start --token "ca_mach_..."
```

### Python API Execution
```bash
cd apps/api
uv run main.py
```

---

## 🔍 Code Review & Verification Checklist

Before reporting completion to the user:
- [ ] No unhandled TypeScript errors or compiler warnings.
- [ ] `git status` shows only intentional, clean changes.
- [ ] No background processes crashed or orphaned.
- [ ] File paths in responses use forward slashes with clickable `file:///` links.
- [ ] Response is concise, markdown-formatted, and points directly to relevant code artifacts.
