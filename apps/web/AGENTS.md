# apps/web — Autonomous Agent Guidelines

This document provides strict styling rules, architectural constraints, and coding standards for all autonomous AI agents and engineers contributing to `apps/web`.

---

## 🎨 UI & Styling Standards (Black, White, Gray & #0077b6)

Adhere strictly to the monorepo design language:

- **Canvas Background**: `#0d1117`
- **Canvas Inset**: `#010409`
- **Card / Surface**: `#161b22`
- **Borders & Dividers**: `#21262d` (subtle) / `#30363d` (card boundaries)
- **Primary Text**: `#f0f6fc`
- **Secondary Text**: `#c9d1d9`
- **Muted Text**: `#8b949e`
- **Pacific Azure Blue (Primary Accent)**:
  - `#0077b6` (primary buttons, active tabs, highlights)
  - `#0096c7` / `#48cae4` (light accents)
  - `rgba(0, 119, 182, 0.15)` (pill background)

---

## 📜 Invariants & Operational Rules

### 1. Zero-Mock Data Invariant
- **NEVER** introduce fake PR simulations, hardcoded machines, or mock usernames.
- All nodes, terminals, and chat turns must render real data streamed from Gateway and Daemons.

### 2. Component Design System
- Use Tailwind CSS utility classes and `shadcn/ui` components located in `src/components/ui/`.
- Maintain clean Lucide React icons.

### 3. Responsive Breakpoints
- Ensure all dashboard views adapt gracefully to desktop (`1440px+`), laptop (`1024px`), and tablet (`768px`) displays.

---

## 🛠️ Verification Commands

```bash
# Typecheck web package
pnpm --filter @cloud-agent/web typecheck

# Build web package
pnpm --filter @cloud-agent/web build

# Start dev server
pnpm --filter @cloud-agent/web dev
```
