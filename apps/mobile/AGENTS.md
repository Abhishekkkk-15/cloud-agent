# apps/mobile — Autonomous Agent Guidelines

This document provides strict UI/UX standards, architectural rules, and coding conventions for all autonomous AI agents and human engineers contributing to `apps/mobile`.

---

## 🎨 UI & Styling Standards (Official Default PanelUI Dark & White)

Strictly adhere to the **Official Default PanelUI** design tokens (via `panelui-native/theme.css` and Uniwind):

### PanelUI Dark Palette (Default)
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

### PanelUI White / Light Palette
- **Background**: `#ffffff` (`bg-background`)
- **Card Surface**: `#ffffff` (`bg-card`)
- **Popover / Modal Surface**: `#ffffff` (`bg-popover`)
- **Nested Surfaces**: `#f7f7f7` (`bg-surface`), `#f1f1f1` (`bg-surface-secondary`), `#eaeaea` (`bg-surface-tertiary`)
- **Primary Text**: `#262626` (`text-foreground`)
- **Muted Text**: `#686868` (`text-muted-foreground`)
- **Borders & Dividers**: `rgba(0, 0, 0, 0.08)` (`border-border`)
- **Primary Accent / Actions**: High-contrast `#262626` (`bg-primary`, `text-primary-foreground: #fafafa`)
- **Secondary / Subtles**: `rgba(0, 0, 0, 0.06)` (`bg-secondary`, `bg-muted`)

### Status Tokens (Telemetry & Alerts Only)
- **Info**: `#3b82f6`
- **Success / Live**: `#10b981`
- **Warning**: `#f59e0b`
- **Destructive / Error**: `#ef4444`

---

## 📜 Invariants & Design Rules

### 1. PanelUI-Native Component-First Invariant
- **ALWAYS** use `panelui-native` components for all UI elements across `apps/mobile`:
  - **Navigation & Drawer**: `Drawer`, `Panelside`, `Tree`, `Tabs`, `Menu`, `Breadcrumb`
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
  - Strictly adhere to the Black, White, Gray, and `#0077b6` palette (`#0d1117` canvas, `#161b22` card surface, `#0077b6` accent).
  - Avoid creating bulky manual `StyleSheet.create` rules for layouts easily handled by Tailwind utility classes.
- **Gesture & Reanimated Integrity**:
  - Leverage `panelui-native`'s built-in `react-native-reanimated` and `react-native-gesture-handler` integration for 60fps UI-thread interactions.
  - Do not implement redundant custom `PanResponder` handlers or JavaScript timer animations when a `panelui-native` component provides native physics-based gestures.
- **Root Provider Mandate**:
  - Always keep `apps/mobile/src/App.tsx` wrapped with `<PanelUIProvider>` and ensure `apps/mobile/src/global.css` is imported at the entry point so portal hosts, toast viewports, and themed surfaces mount properly.

### 2. Zero-Mock & Clean Agent UI Invariant
- All UI components (chat sessions, turns, tool execution trays, machine health, and approvals) must render dynamic data from daemon and gateway streams only.
- **NEVER** introduce hardcoded fallback turns, fake pull request or merge conflict simulations, fake user usernames (e.g. `@Abhishekkk-15 commented:`), fake credits, or hardcoded machine hostnames (e.g. `DESKTOP-...`).
- Remove GitHub PR UI artifacts ("commit", "merge", floating "VIEW PR" buttons).

### 3. Navigation & Layout Conventions
- **Default Screen**: App opens by default on the Chat screen (`AgentTurnScreen`) with the previously/last opened session auto-selected.
- **No Bottom Navbar**: Navigation is driven by a swipeable sidebar drawer (`SidebarDrawer.tsx`) accessible via left-edge swipe or tapping the circular `<` header button.
- **Header Bar**: Features a circular 36x36 dark gray button with `<` icon beside the clean session title.
- **Chat Input Bar**: Capsule pill-shaped container (`borderRadius: 28`) with an embedded circular `+` button on the left, "Type a message..." placeholder, and send / microphone action on the right.

### 4. Dynamic Host Resolution
- **NEVER** hardcode `127.0.0.1` or `localhost` in `apps/mobile` store URLs.
- On Android and iOS devices, `127.0.0.1` refers to the device itself. Always extract the host dynamically from `NativeModules.SourceCode.scriptURL` with fallbacks for web (`window.location.hostname`) or deployed gateway URL.

### 5. Lucide Icons
- All icons must be imported from [`apps/mobile/src/components/Icons.tsx`](file:///D:/python/cloud-agent/apps/mobile/src/components/Icons.tsx). Wrap any newly required Lucide icons in `Icons.tsx` using `wrapIcon`.

---

## 🛠️ Verification Commands

Before completing any task affecting `apps/mobile`, verify:

```bash
# Typecheck mobile package
pnpm --filter @cloud-agent/mobile typecheck
```
