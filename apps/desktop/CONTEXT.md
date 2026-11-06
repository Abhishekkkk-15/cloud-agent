# apps/desktop — Architectural Context

`apps/desktop` is the native desktop companion app for Cloud Agent built on Tauri (Rust) and React / Vite. It gives power users high-performance local windowing, system tray integration, native shortcuts, and offline-first fleet monitoring.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│                     apps/desktop                       │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │              Tauri Core (Rust)                 │   │
│   │  • System Tray, Menus & Global Hotkeys         │   │
│   │  • Native OS Notifications                     │   │
│   │  • Local Daemon Process Lifecycle Management   │   │
│   └──────────────────────┬─────────────────────────┘   │
│                          │ IPC / Tauri Invoke          │
│   ┌──────────────────────▼─────────────────────────┐   │
│   │              Webview UI (React 19)             │   │
│   │  • Multi-node Fleet Manager                    │   │
│   │  • Split-pane Diff Reviewer                    │   │
│   │  • Embedded Native Terminal Panels             │   │
│   └──────────────────────┬─────────────────────────┘   │
└──────────────────────────┼─────────────────────────────┘
                           │ WebSocket / WebRTC
                           ▼
               ┌───────────────────────┐
               │ apps/gateway & daemon │
               └───────────────────────┘
```

---

## 🔑 Core Subsystems & Directory Structure

```
apps/desktop/
├── src-tauri/          # Rust backend (Tauri application config, tray, IPC commands)
│   ├── src/main.rs         # Tauri application entrypoint
│   └── tauri.conf.json     # Window dimensions, permissions, bundle configs
└── src/                # Frontend UI
    ├── main.tsx            # React application entrypoint
    ├── App.tsx             # Main dashboard view
    ├── components/         # Desktop-specific components (tray menus, multi-panes)
    ├── stores/             # Zustand state stores (auth, fleet, local node)
    └── lib/                # Tauri IPC wrappers & WebSocket clients
```

---

## ⚡ Runtime Data Flow

1. **Native Shell Launch**: Tauri launches native window with dark borderless chrome.
2. **Local Daemon Management**: Can directly spawn, monitor, and attach to local `apps/daemon` processes.
3. **Gateway Signaling**: Connects to Gateway to orchestrate remote nodes and stream turns seamlessly.
