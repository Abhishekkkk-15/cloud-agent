# apps/web — Architectural Context

`apps/web` is the React / Vite desktop-class web dashboard for Cloud Agent. It provides browser-based fleet monitoring, multi-VPS management, live agent session inspectability, and remote terminal operations.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│                      apps/web                          │
│               (React 19 / Vite / Tailwind)             │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │                 Pages & Views                  │   │
│   │  • Fleet Overview & Node Telemetry             │   │
│   │  • Live Agent Session & Turn Inspector         │   │
│   │  • Remote Terminal & Command Runner            │   │
│   │  • Machine Pairing & Token Management          │   │
│   └──────────────────────┬─────────────────────────┘   │
│                          │                             │
│   ┌──────────────────────▼─────────────────────────┐   │
│   │             Zustand Stores & Hooks             │   │
│   │  • useAuthStore (Google OAuth / Session Token) │   │
│   │  • useFleetStore (Live nodes & status)         │   │
│   │  • useTerminalStore (Live xterm output)        │   │
│   └──────────────────────┬─────────────────────────┘   │
└──────────────────────────┼─────────────────────────────┘
                           │ WebSocket / HTTPS
                           ▼
               ┌───────────────────────┐
               │      apps/gateway     │
               └───────────────────────┘
```

---

## 🔑 Core Subsystems & Directory Structure

```
apps/web/src/
├── main.tsx        # React root mount and router setup
├── App.tsx         # Main layout container and navigation bar
├── pages/          # Top-level view controllers (Fleet, Sessions, Terminal, Settings)
├── components/     # UI components (shadcn/ui, cards, modals, terminal visualizers)
├── stores/         # State management stores (auth, fleet, chat turns)
├── hooks/          # React hooks (WebRTC, WebSocket, media queries)
├── lib/            # Utility functions and API client
└── types/          # TypeScript definitions
```

---

## ⚡ Runtime Data Flow

1. **Authentication**: Authenticates with `apps/gateway` via Google OAuth or developer token.
2. **Gateway WebSocket**: Connects to `wss://gateway.cloud-agent.abhishekkkk.in/client/ws` to receive live machine telemetry and session turn streams.
3. **Responsive Layout**: Designed for wide monitors and tablets with sidebars, split-pane diff reviewers, and collapsible terminal drawers.
