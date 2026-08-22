# Cloud Agent

Turborepo + pnpm monorepo for the Cloud Agent platform.

## Structure

```
apps/
  web/              # React + Vite web IDE / agent UI
packages/
  shared/           # Shared Zod schemas and TypeScript types
```

Future apps (`api`, `local-agent`, `desktop`) can be added under `apps/`.

## Requirements

- Node.js 20+
- [pnpm](https://pnpm.io/) 9+

## Commands

From the repo root:

```bash
pnpm install
pnpm dev          # start all dev servers (web on :5173)
pnpm build        # build all packages
pnpm typecheck    # typecheck all packages
pnpm lint         # lint all packages
```

Run a single app:

```bash
pnpm --filter @cloud-agent/web dev
```

## Packages

| Package | Description |
|---------|-------------|
| `@cloud-agent/web` | Browser workspace UI |
| `@cloud-agent/shared` | Shared contracts (schemas, types) for web, API, local agent, desktop |
