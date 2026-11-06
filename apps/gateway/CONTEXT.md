# apps/gateway — Architectural Context

`apps/gateway` is the central coordination hub and WebSocket routing engine for Cloud Agent. It connects mobile clients, developer laptops, and remote VPS daemons across the globe.

---

## 🏛️ System Architecture

```
                       ┌─────────────────────────┐
                       │   Google OAuth 2.0      │
                       └────────────▲────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────┐
│                   apps/gateway                         │
│                  (Port 8080 / 0.0.0.0)                 │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │                 HTTP Router                    │   │
│   │  • /auth/*          (Google OAuth & /auth/me)  │   │
│   │  • /api/machines/*  (Tokens & /pair/* endpoints│   │
│   │  • /preview/*       (Web preview tunnel proxy) │   │
│   │  • /install.sh      (Daemon shell installer)   │   │
│   │  • /api/push/*      (Expo push notifications)  │   │
│   └──────────────────────┬─────────────────────────┘   │
│                          │                             │
│   ┌──────────────────────▼─────────────────────────┐   │
│   │            WebSocket Hub (routes/ws.ts)        │   │
│   │  • /daemon/ws  <-->  DaemonHub (VPS Nodes)     │   │
│   │  • /client/ws  <-->  ClientHub (Mobile Clients)│   │
│   │  • WebRTC Signaling (SDP Offer / Answer Relay) │   │
│   └──────────────────────┬─────────────────────────┘   │
└──────────────────────────┼─────────────────────────────┘
                           │
                           ▼
               ┌───────────────────────┐
               │     MongoDB Atlas     │
               │  (Users, Machines)    │
               └───────────────────────┘
```

---

## 🔑 Core Subsystems & Directory Structure

```
apps/gateway/src/
├── index.ts        # HTTP server entrypoint, WebSocket upgrade handler, graceful shutdown
├── config.ts       # Environment variable config (port, mongoUri, googleClientId, jwtSecret)
├── hub/
│   ├── daemon-hub.ts # In-memory active daemon connection manager, RPC sender & timeout tracker
│   └── client-hub.ts # In-memory active mobile client connection manager
├── routes/
│   ├── auth.ts       # Google OAuth callback, developer login, JWT generation, /auth/me
│   ├── machines.ts   # Machine listing, unpairing, and reverse pairing sessions (/pair/init, poll, claim)
│   ├── tunnel.ts     # Ephemeral HTTP preview tunnel proxy (/preview/:tunnelId/*)
│   ├── installer.ts  # Serves raw bash and powershell daemon installer scripts (/install.sh, /install.ps1)
│   ├── push.ts       # Expo Push Notification token registration & notification delivery
│   ├── webhooks.ts   # External webhook receiver
│   └── ws.ts         # WebSocket upgrade routing (/daemon/ws, /client/ws)
├── db/
│   ├── mongo.ts      # MongoDB connection pool
│   ├── machine-repo.ts # Machine records, tokens, status updates
│   └── user-repo.ts    # User accounts, OAuth profile upsert
└── auth/
    └── jwt.ts        # JWT token generation, verification, and rotation
```

---

## ⚡ Runtime Data Flow

1. **Daemon Connection**: VPS and workstations connect to `/daemon/ws` using machine bearer tokens (`ca_mach_...`). Validated against MongoDB.
2. **Reverse Pairing Flow**: Terminal runs `ca pair` -> calls `/api/machines/pair/init` -> mobile scans QR or enters 6-character code (`CA-XXXX`) -> calls `/api/machines/pair/claim` -> Gateway stores credentials and returns token to the waiting daemon.
3. **WebRTC Signaling**: Gateway exchanges SDP offers, answers, and ICE candidates between mobile clients and daemons.
4. **Fallback RPC Proxy**: If WebRTC fails or is establishing, RPC requests from clients are routed through Gateway to the target daemon over WebSocket.
5. **Web Preview Tunnel Proxy**: Incoming `/preview/:tunnelId/*` requests are proxied over WebSocket to the daemon on port 3000, 5173, etc.
