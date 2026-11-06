# apps/desktop — Autonomous Agent Guidelines

This document provides development instructions, operational rules, and safety boundaries for autonomous AI agents and engineers working on `apps/desktop`.

---

## 🎨 UI & Styling Standards (Black, White, Gray & #0077b6)

Strictly adhere to the dark desktop aesthetic:

- **Canvas Background**: `#0d1117`
- **Canvas Inset**: `#010409`
- **Surface / Card**: `#161b22`
- **Borders & Dividers**: `#21262d` (subtle) / `#30363d` (card boundaries)
- **Primary Text**: `#f0f6fc`
- **Secondary Text**: `#c9d1d9`
- **Muted Text**: `#8b949e`
- **Pacific Azure Blue (Primary Accent)**: `#0077b6`, `#0096c7`

---

## 📜 Invariants & Operational Rules

### 1. Tauri Native IPC Safety
- Do not expose arbitrary unsafe shell execution over unauthenticated IPC channels.
- Use validated Tauri commands defined in `src-tauri/src/main.rs`.

### 2. Cross-Platform Window Behavior
- Test that window minimize, maximize, and system tray minimize operate correctly on Windows, macOS, and Linux.

### 3. Zero-Mock Data Invariant
- All sessions and machines rendered in the desktop view must originate from real daemons and the Gateway hub.

---

## 🛠️ Verification Commands

```bash
# Typecheck desktop package
pnpm --filter @cloud-agent/desktop typecheck

# Build desktop package
pnpm --filter @cloud-agent/desktop build

# Run in development mode
pnpm --filter @cloud-agent/desktop dev
```
