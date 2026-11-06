# apps/mobile — Autonomous Agent Guidelines

This document provides strict UI/UX standards, architectural rules, and coding conventions for all autonomous AI agents and human engineers contributing to `apps/mobile`.

---

## 🎨 UI & Styling Standards (Black, White, Gray & #0077b6)

Strictly adhere to the design palette defined in `AGENTS.md`:

- **Canvas Background**: `#0d1117`
- **Canvas Inset**: `#010409`
- **Card / Surface**: `#161b22`
- **Borders & Dividers**: `#21262d` (subtle) / `#30363d` (card boundaries)
- **Hover / Inset**: `#21262d`
- **Primary Text**: `#f0f6fc`
- **Secondary Text**: `#c9d1d9`
- **Muted Text**: `#8b949e` / `#6e7681`
- **Pacific Azure Blue (Primary Accent)**:
  - `#0077b6` (primary buttons, active highlights, badges)
  - `#0096c7` / `#48cae4` (light accent text, highlights)
  - `rgba(0, 119, 182, 0.15)` (subtle pill/active item background)
  - `rgba(0, 119, 182, 0.35)` (subtle border)
- **Chat Panel Tool Icons**: Use clean white (`#ffffff` / `#f0f6fc`) for all tool category icons.
- **Danger Red (Exceptions / Alerts only)**: `#f85149` (text/icons), `#da3633` (bg)

---

## 📜 Invariants & Design Rules

### 1. Zero-Mock & Clean Agent UI Invariant
- All UI components (chat sessions, turns, tool execution trays, machine health, and approvals) must render dynamic data from daemon and gateway streams only.
- **NEVER** introduce hardcoded fallback turns, fake pull request or merge conflict simulations, fake user usernames (e.g. `@Abhishekkk-15 commented:`), fake credits, or hardcoded machine hostnames (e.g. `DESKTOP-...`).
- Remove GitHub PR UI artifacts ("commit", "merge", floating "VIEW PR" buttons).

### 2. Navigation & Layout Conventions
- **Default Screen**: App opens by default on the Chat screen (`AgentTurnScreen`) with the previously/last opened session auto-selected.
- **No Bottom Navbar**: Navigation is driven by a swipeable sidebar drawer (`SidebarDrawer.tsx`) accessible via left-edge swipe or tapping the circular `<` header button.
- **Header Bar**: Features a circular 36x36 dark gray button with `<` icon beside the clean session title.
- **Chat Input Bar**: Capsule pill-shaped container (`borderRadius: 28`) with an embedded circular `+` button on the left, "Type a message..." placeholder, and send / microphone action on the right.

### 3. Dynamic Host Resolution
- **NEVER** hardcode `127.0.0.1` or `localhost` in `apps/mobile` store URLs.
- On Android and iOS devices, `127.0.0.1` refers to the device itself. Always extract the host dynamically from `NativeModules.SourceCode.scriptURL` with fallbacks for web (`window.location.hostname`) or deployed gateway URL.

### 4. Lucide Icons
- All icons must be imported from [`apps/mobile/src/components/Icons.tsx`](file:///D:/python/cloud-agent/apps/mobile/src/components/Icons.tsx). Wrap any newly required Lucide icons in `Icons.tsx` using `wrapIcon`.

---

## 🛠️ Verification Commands

Before completing any task affecting `apps/mobile`, verify:

```bash
# Typecheck mobile package
pnpm --filter @cloud-agent/mobile typecheck
```
