# Cloud Agent Mobile (`apps/mobile`) 📱

<div align="center">

**React Native (Expo) Client for Cloud Agent**

Pair with workstations, cloud servers, and Docker sandboxes to direct autonomous AI coding agents on the go.

[![React Native](https://img.shields.io/badge/React%20Native-Expo%2052-61dafb?style=flat-square&logo=react&logoColor=black)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## 🌟 Key Features

- **Fluid Dark Architecture**: Black, white, slate gray (`#161b22`), and Pacific Azure (`#0077b6`) palette designed for high contrast and readability on mobile screens.
- **Sidebar Drawer Navigation**: Left-edge swipeable drawer to switch connected host machines, active workspaces, and past chat sessions.
- **Live Tool Execution Trays**: Real-time inspection trays for agent tool executions (`run_command`, `read_file`, `edit_file`, `web_search`) with syntax-highlighted diffs and bash outputs.
- **Instant Node Pairing**: Connect to host daemons via QR code scan or 6-character short code (`ca pair`).
- **Persistent WebSocket Streaming RPCs**: Low-latency bidirectional RPC calls and real-time streaming chunks over persistent Gateway WebSockets.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- [Expo Go](https://expo.dev/go) on iOS or Android, or an active simulator/emulator

### Running Locally
```bash
# From monorepo root:
pnpm --filter @cloud-agent/mobile dev

# Or with specific platforms:
pnpm --filter @cloud-agent/mobile ios
pnpm --filter @cloud-agent/mobile android
```

Scan the Metro QR code with **Expo Go** (Android) or the Camera app (iOS).

---

## 🏛️ Architecture & Guidelines

- Architecture: see [`apps/mobile/CONTEXT.md`](./CONTEXT.md)
- Styling & UX rules: see [`apps/mobile/AGENTS.md`](./AGENTS.md)
