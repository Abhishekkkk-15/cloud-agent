# Cloud Agent Daemon (`ca`) 💻⚡

<div align="center">

**Zero-DB Pluggable Autonomous Coding Agent Host Daemon**

Connects your local workstation, laptop, or remote cloud VPS to the Cloud Agent Mobile ecosystem.

[![Node.js](https://img.shields.io/badge/Node.js-20+-68a063?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-blue?style=flat-square)](#quick-install)
[![Architecture](https://img.shields.io/badge/Architecture-Zero--DB%20%7C%20Outbound--Only-success?style=flat-square)](#core-invariants)

</div>

---

## 🚀 Quick Install

Install `ca` and `cloud-agent-daemon` globally on your computer with a single command:

### 🐧 Linux & 🍎 macOS (Bash / Zsh)
```bash
curl -fsSL https://gateway.cloud-agent.abhishekkkk.in/install.sh | bash
```

### 🪟 Windows (PowerShell)
```powershell
irm https://gateway.cloud-agent.abhishekkkk.in/install.ps1 | iex
```

*Once installed, verify with:*
```bash
ca doctor
```

---

## ⚡ Instant Machine Pairing (`ca pair`)

No more generating tokens on your phone, copying them, and transferring them to your host machine. Simply run:

```bash
ca pair
```

```
┌───────────────────────────────────────────────┐
│              Cloud Agent Daemon               │
│        Zero-DB Pluggable Coding Agent         │
└───────────────────────────────────────────────┘

════════════════════════════════════════════════════════════════
  Cloud Agent — Instant Node Pairing
  Machine Name : Ubuntu-VPS
  Pairing Code : CA-1687  (valid for 10 minutes)
════════════════════════════════════════════════════════════════

Scan this QR code from your Cloud Agent mobile app to pair instantly:

▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
█ ▄▄▄▄▄ █ ▄▀█  ▄▄ ▀█ ▄▄█  █▀ █ ▄▄▄▄▄ █
█ █   █ █ █ █▀▀▄▄ ▄▀▀▀█▀▀▄ ▄█ █   █ █
█ █▄▄▄█ █ █▄█▀▄ ▄█▄ █▄  █▀█ ▄ █▄▄▄█ █
█▄▄▄▄▄▄▄█▄▄▄█▄▄▄▄█▄█▄██▄██▄█▄▄█▄▄▄▄▄▄▄█
...

Waiting for mobile authorization...
```

1. Open **Cloud Agent Mobile** -> **Pair Machine**.
2. Point your camera at the terminal QR code (or type `CA-1687` in **Enter Code**).
3. **Done!** The machine is instantly authorized, credentials are saved, and the daemon starts automatically.

---

## 🛠️ CLI Command Reference

### 1. Core Commands
| Command | Description |
|---|---|
| `ca start` | Starts daemon in foreground, connecting outbound to Gateway |
| `ca pair` | Interactive reverse pairing flow (renders ASCII QR & code) |
| `ca status` | Prints machine ID, connection status, token state, and paths |
| `ca doctor` | Runs health check on Node, Git, CLI adapters, network, and disk |

### 2. Workspace Management (`ca workspace`)
Manage project directories on this machine and sync them instantly to your mobile drawer:
```bash
# Register current folder as a workspace
ca workspace add .

# Register a specific project folder
ca workspace add ~/projects/my-app

# List all registered workspaces and git branches
ca workspace list

# Remove a workspace
ca workspace remove ~/projects/my-app
```

### 3. Background Service Management (`ca service`)
Run Cloud Agent 24/7 as an autonomous background daemon that survives reboots and SSH disconnects:
```bash
# Register daemon as a system service
#   • Linux:   systemd user unit (~/.config/systemd/user/cloud-agent.service)
#   • macOS:   launchd LaunchAgent (~/Library/LaunchAgents/com.cloudagent.daemon.plist)
#   • Windows: scheduled task / background process
ca service install

# Control the service
ca service start     # Start background daemon
ca service status    # Check status and PID
ca service restart   # Restart service
ca service stop      # Stop background process
ca service uninstall # Remove service unit
```

### 4. Log Streaming (`ca logs`)
Inspect daemon activity, connection events, and agent turn outputs:
```bash
# View last 50 log lines from ~/.cloud-agent/daemon.log
ca logs

# View last 100 lines
ca logs --lines=100

# Follow live output in real-time (like tail -f)
ca logs -f
```

### 5. Web Preview & Port Forwarding (`ca expose <port>`)
Expose local dev servers (e.g., Next.js on port 3000, Vite on 5173, FastAPI on 8000) so you can test them directly on your phone:
```bash
ca expose 3000
```
- **Local Network**: Detects local Wi-Fi IP (`http://192.168.x.x:3000`) for direct testing.
- **Gateway Preview Tunnel**: Registers an ephemeral public URL (`https://gateway.../preview/:tunnelId/`) and prints a QR code. Requests are proxied over your daemon's existing WebSocket connection with zero inbound open ports.

---

## 🏛️ Core Invariants & Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Host Machine / VPS                   │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │               apps/daemon                      │   │
│   │                                                │   │
│   │  • CLI Entrypoint: 'ca' / 'cloud-agent-daemon' │   │
│   │  • Outbound WebSocket Connection (No in ports) │   │
│   │  • High-Speed WebSocket Streaming Relay       │   │
│   │  • Line-by-line NDJSON transcript streaming   │   │
│   │  • Warm Persistent Process Pool (No re-reads)  │   │
│   └──────────────────────┬─────────────────────────┘   │
│                          │                             │
│   ┌──────────────────────▼─────────────────────────┐   │
│   │     Local AI CLI: Google Antigravity ('agy')   │   │
│   │     Local Git Repositories & Workspaces        │   │
│   └────────────────────────────────────────────────┘   │
└──────────────────────────┬─────────────────────────────┘
                           │ Outbound Only (/daemon/ws)
                           ▼
               ┌───────────────────────┐
               │  Cloud Agent Gateway  │
               └───────────────────────┘
```

1. **Zero-DB Daemon Invariant**: The daemon is completely database-free. It never installs or connects to databases. Configurations live in `~/.cloud-agent/daemon.json`, and chat transcripts are streamed directly from native disk files line-by-line.
2. **Zero Inbound Ports**: Never requires open incoming ports, firewall rules, or public IP addresses. Dials outbound to Gateway hub.
3. **Warm Persistent Process Pool**: Keeps worker processes warm with an open `stdin` pipe to prevent multi-second cold-start latency between chat turns.
4. **Headless Execution**: CLI adapters execute with permission bypass (`--dangerously-skip-permissions`) so unattended background runs never block on interactive TTY inputs.

---

## 🛠️ Monorepo Development

```bash
# Run typecheck
pnpm --filter @cloud-agent/daemon typecheck

# Build daemon package
pnpm --filter @cloud-agent/daemon build

# Run in development mode
pnpm --filter @cloud-agent/daemon dev start
```
