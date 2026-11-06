# Cloud Agent Desktop (`apps/desktop`) 🖥️

<div align="center">

**Cross-Platform Electron Desktop Shell for Cloud Agent**

Native desktop environment for monitoring machines, reviewing agent diffs, and orchestrating coding tasks.

[![Electron](https://img.shields.io/badge/Electron-33+-47848f?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## 🌟 Overview

`apps/desktop` wraps the Cloud Agent experience into a native cross-platform window (macOS, Windows, Linux) with hardware acceleration, system tray presence, and direct OS notification support.

---

## 🚀 Running Desktop

```bash
# From monorepo root:
pnpm --filter @cloud-agent/desktop dev

# Build for distribution:
pnpm --filter @cloud-agent/desktop build
```

---

## 🏛️ Architecture & Guidelines

- Architecture: see [`apps/desktop/CONTEXT.md`](./CONTEXT.md)
- Development guidelines: see [`apps/desktop/AGENTS.md`](./AGENTS.md)
