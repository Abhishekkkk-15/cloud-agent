# Cloud Agent Gateway (`apps/gateway`) 🌐

<div align="center">

**Central WebSocket Multiplexer, Pairing Manager & Tunnel Proxy**

The high-throughput nervous system bridging mobile clients, web workspaces, and remote host daemons.

[![Node.js](https://img.shields.io/badge/Node.js-20+-68a063?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## 🌟 Key Responsibilities

1. **Daemon WebSocket Hub (`/daemon/ws`)**: Outbound-only connection point for `ca` host daemons with zero open inbound ports on the host.
2. **Instant Node Pairing (`/pair/*`)**: Generates short pairing codes and QR tokens (`ca pair`) and securely exchanges machine credentials with mobile clients.
3. **Ephemeral Dev Server Tunnels (`/preview/:tunnelId/*`)**: Proxies mobile preview requests over active daemon WebSockets to view local dev servers (`ca expose <port>`).
4. **Installer Script Host (`/install.sh`, `/install.ps1`)**: Serves single-line curl/PowerShell installation scripts directly from the gateway server.
5. **WebRTC Signaling**: Coordinates ICE candidate exchange and SDP offers/answers between mobile clients and host daemons.

---

## 🚀 Running Gateway

```bash
# From monorepo root:
pnpm --filter @cloud-agent/gateway dev

# Or build & start production:
pnpm --filter @cloud-agent/gateway build
pnpm --filter @cloud-agent/gateway start
```

Default port: `8080` (binds to `0.0.0.0`).

---

## 🏛️ Architecture & Protocol Specifications

- Architecture & Protocol: see [`apps/gateway/CONTEXT.md`](./CONTEXT.md)
- Operational rules: see [`apps/gateway/AGENTS.md`](./AGENTS.md)
