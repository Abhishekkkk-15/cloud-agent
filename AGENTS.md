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

7. **PanelUI-Native Component-First Invariant (`apps/mobile`)**:
   - **ALWAYS** use `panelui-native` components for all UI elements across `apps/mobile`:
     - **Navigation & Hierarchy**: `Drawer`, `Panelside`, `Tree`, `Tabs`, `Menu`, `Breadcrumb`
     - **AI Conversations & Streaming**: `Message`, `MessageScroller`, `Response`, `Reasoning`, `Sources`, `CodeBlock`, `AIInput`, `ThinkingOrb`
     - **Sheets, Modals & Trays**: `BottomSheet`, `Dialog`, `Popover`, `Toast`
     - **Data & Telemetry Metrics**: `Kpi`, `LineChart`, `BarChart`, `HeatmapChart`, `PieChart`, `Progress`, `Table`
     - **Forms & Controls**: `Button`, `ButtonGroup`, `Input`, `Select`, `Combobox`, `Checkbox`, `Switch`, `Badge`
     - **Containers & Feedback**: `Card`, `Item`, `EmptyState`, `Skeleton`, `Spinner`, `Collapse`
   - **NEVER** build custom one-off React Native components when a `panelui-native` equivalent exists.
   - **Only create or maintain custom components if**:
     1. The user explicitly requests a custom implementation, OR
     2. `panelui-native` genuinely lacks a component for that specific capability.
   - **Styling via Uniwind / Tailwind CSS v4**:
     - Style `panelui-native` components using Tailwind utility classes (`className="..."`) and `panelui-native` theme tokens.
     - Strictly adhere to the Black, White, and Gray monochrome palette (with high-contrast primary accents `#f5f5f5` / `#262626` and semantic status indicators).
     - Avoid creating bulky manual `StyleSheet.create` rules for layouts easily handled by Tailwind utility classes.
   - **Gesture & Reanimated Integrity**:
     - Leverage `panelui-native`'s built-in `react-native-reanimated` and `react-native-gesture-handler` integration for 60fps UI-thread interactions.
     - Do not implement redundant custom `PanResponder` handlers or JavaScript timer animations when a `panelui-native` component provides native physics-based gestures.
   - **Root Provider Mandate**:
     - Always keep `apps/mobile/src/App.tsx` wrapped with `<PanelUIProvider>` and ensure `apps/mobile/src/global.css` is imported at the entry point so portal hosts, toast viewports, and themed surfaces mount properly.

---

## 🎨 UI & Styling Standards (Official Default PanelUI Dark & White)

When working on `apps/mobile` or client UI components:
- Strictly adhere to the **Official Default PanelUI** design tokens (via `panelui-native/theme.css` and Uniwind):
  - **PanelUI Dark Palette (Default)**:
    - **Background**: `#141414` (`bg-background`)
    - **Card Surface**: `#191919` (`bg-card`)
    - **Popover / Modal Surface**: `#1d1d1d` (`bg-popover`)
    - **Floating Overlay**: `#232323` (`bg-overlay`)
    - **Nested Surfaces**: `#1e1e1e` (`bg-surface`), `#242424` (`bg-surface-secondary`), `#2a2a2a` (`bg-surface-tertiary`)
    - **Primary Text**: `#f5f5f5` (`text-foreground`)
    - **Muted Text**: `#a3a3a3` (`text-muted-foreground`)
    - **Borders & Dividers**: `rgba(255, 255, 255, 0.10)` (`border-border`)
    - **Primary Accent / Actions**: High-contrast `#f5f5f5` (`bg-primary`, `text-primary-foreground: #262626`)
    - **Secondary / Subtles**: `rgba(255, 255, 255, 0.08)` (`bg-secondary`, `bg-muted`)
  - **PanelUI White / Light Palette**:
    - **Background**: `#ffffff` (`bg-background`)
    - **Card Surface**: `#ffffff` (`bg-card`)
    - **Popover / Modal Surface**: `#ffffff` (`bg-popover`)
    - **Nested Surfaces**: `#f7f7f7` (`bg-surface`), `#f1f1f1` (`bg-surface-secondary`), `#eaeaea` (`bg-surface-tertiary`)
    - **Primary Text**: `#262626` (`text-foreground`)
    - **Muted Text**: `#686868` (`text-muted-foreground`)
    - **Borders & Dividers**: `rgba(0, 0, 0, 0.08)` (`border-border`)
    - **Primary Accent / Actions**: High-contrast `#262626` (`bg-primary`, `text-primary-foreground: #fafafa`)
    - **Secondary / Subtles**: `rgba(0, 0, 0, 0.06)` (`bg-secondary`, `bg-muted`)
  - **Swiss Minimalist Palette (Tactile Newsprint / Paper)**:
    - **Background**: `#F8F3EC` (`bg-background`) / Obsidian Dark: `#141312`
    - **Card Surface**: `#F1EBE1` (`bg-card`) / Obsidian Dark: `#1C1B19`
    - **Popover / Modal Surface**: `#EDE6DB` (`bg-popover`)
    - **Nested Surfaces**: `#EBE4D8` (`bg-surface`), `#E4DCD0` (`bg-surface-secondary`)
    - **Primary Text**: `#111010` (`text-foreground`) / Obsidian Dark: `#F4F0E8`
    - **Muted Text**: `#6B665E` (`text-muted-foreground`) / Obsidian Dark: `#9C9589`
    - **Borders & Dividers**: `rgba(17, 16, 16, 0.16)` (`border-border`)
    - **Primary Accent / Actions**: Swiss Signal Red `#DC201E` (`bg-primary`, `text-primary-foreground: #ffffff`)
    - **Secondary / Subtles**: `rgba(17, 16, 16, 0.06)` (`bg-secondary`, `bg-muted`)
  - **Status & Telemetry Only**:
    - **Info**: `#3b82f6`
    - **Success / Live**: `#10b981`
    - **Warning**: `#f59e0b`
    - **Destructive / Error**: `#ef4444`
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
