# packages/cli/antigravity — Autonomous Agent Guidelines

This document provides operational rules and guidelines for autonomous AI agents and engineers working on `@cloud-agent/cli-antigravity`.

---

## 📜 Invariants & Guidelines

### 1. Headless Execution
- Always pass `--dangerously-skip-permissions` to `agy` so child processes run non-interactively without prompting for `[y/n]` confirmations.

### 2. Line-by-Line NDJSON Streaming
- Chat messages and events must be parsed progressively as newline-delimited JSON objects (`NDJSON`). Never buffer an entire multi-megabyte transcript file into memory at once.

### 3. Process Pool Invariant
- Maintain warm child processes with open `stdin` streams per session. Do not spawn fresh processes for every chat turn.

---

## 🛠️ Verification Commands

```bash
# Typecheck adapter package
pnpm --filter @cloud-agent/cli-antigravity typecheck

# Build adapter package
pnpm --filter @cloud-agent/cli-antigravity build
```
