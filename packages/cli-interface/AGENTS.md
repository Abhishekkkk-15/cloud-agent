# packages/cli-interface — Autonomous Agent Guidelines

This document provides operational rules and guidelines for autonomous AI agents and engineers working on `@cloud-agent/cli-interface`.

---

## 📜 Invariants & Guidelines

### 1. Zero Dependency Policy
- Keep `packages/cli-interface` free of heavy runtime dependencies. It should contain only pure TypeScript definitions, interfaces, and minimal event helpers.

### 2. Backward Compatibility
- Never remove or mutate existing event field names or session properties without deprecation cycles, as both `apps/daemon` and `apps/mobile` depend directly on these contracts.

---

## 🛠️ Verification Commands

```bash
# Typecheck package
pnpm --filter @cloud-agent/cli-interface typecheck

# Build package
pnpm --filter @cloud-agent/cli-interface build
```
