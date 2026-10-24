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

---

## 🎨 UI & Styling Standards (GitHub Primer Dark)

When working on `apps/mobile` or client UI components:
- Strictly adhere to the GitHub Primer Dark color palette:
  - **Canvas Background**: `#0d1117`
  - **Card / Surface**: `#161b22`
  - **Borders & Dividers**: `#21262d` (subtle) / `#30363d` (card boundaries)
  - **Hover / Inset**: `#21262d`
  - **Primer Green (Success / PR / View)**: `#238636` (accent) / `#3fb950` (text/icons)
  - **GitHub Blue (Actions / Selection)**: `#1f6feb` (buttons) / `#58a6ff` (menu/options)
  - **Commit Badges**: `#79c0ff` text in `#21262d` pill with `#30363d` border
  - **Primary Text**: `#f0f6fc`
  - **Muted Text**: `#8b949e` / `#6e7681`
- Use Lucide icons wrapped via [`apps/mobile/src/components/Icons.tsx`](file:///D:/python/cloud-agent/apps/mobile/src/components/Icons.tsx).
- Ensure all agent tool outputs (e.g. `read_file`, `list_directory`) are rendered cleanly through [`apps/mobile/src/components/MarkdownText.tsx`](file:///D:/python/cloud-agent/apps/mobile/src/components/MarkdownText.tsx).

---

## 🌐 WebRTC P2P & Networking Conventions

- **Zero Inbound Ports**: Never add listening HTTP or socket servers to the Daemon. The daemon only dials outbound to the Gateway Hub (`/daemon/ws`).
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
