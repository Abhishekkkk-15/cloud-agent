# AGENT.md — Working in this workspace

Read **CONTEXT.md** first for the project map. Do **not** re-scan the whole tree for stack, ports, or layout unless those docs are missing or clearly outdated.

## Non‑negotiable stack

| Layer | Must use |
|--------|----------|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS v4 |
| UI | shadcn/ui (`src/components/ui/*`) |
| Backend | Express.js + TypeScript |
| Data | In-memory mock DB (`server/db/mockDb.ts`) — no external DB |
| Package manager | **pnpm** |

Do not switch frameworks, languages, CSS systems, or package managers. If the user asks for something conflicting, keep this stack and still implement the feature.

## Server bind rules (required)

| Service | Host | Port |
|---------|------|------|
| Vite (frontend) | `0.0.0.0` | **4000** |
| Express (API) | `0.0.0.0` | **3000** |

- Never change these ports or bind only to `localhost`.
- Keep `vite.config.ts` → `server.watch.usePolling: true` (Docker HMR).
- Keep the Vite proxy: `/api` → `http://localhost:3000`.

## Commands

```bash
pnpm dev              # client + server together
pnpm dev:client       # Vite only
pnpm dev:server       # Express only
pnpm add <pkg>        # add dependency
```

Prefer editing the existing app over scaffolding a new project from scratch.

## How to build features

1. **UI** — Prefer existing shadcn components (`Button`, `Card`, `Badge`, `Input`, …). Add new shadcn components under `src/components/ui/` when needed; use the `@/` alias.
2. **Pages / app shell** — Start from `src/App.tsx` and `src/main.tsx`. Split into `src/components/` as the app grows.
3. **API** — Add routes in `server/routes/api.ts` (or new routers mounted from `server/index.ts`). Keep paths under `/api/...`.
4. **Data** — Extend `server/db/schema.ts`, seed in `server/db/seed.ts`, use `db.collection(...)` from `mockDb.ts`. Do not introduce Postgres/Mongo/SQLite unless explicitly required by a higher-priority system rule.
5. **Frontend ↔ API** — Call `/api/...` from the client (same origin via Vite proxy). Do not hardcode container host ports in the UI.

## UX / preview rules

- Users see this app in an iframe preview. Do **not** display internal port numbers or infrastructure details in the UI.
- Keep copy product-facing (“API connected”, “Online”), not “Port 4000 / 3000”.

## Efficiency

- Trust CONTEXT.md for structure; open files only when you need to change them.
- After meaningful backend/frontend changes, keep `pnpm dev` running (or restart if needed) so the preview updates.
- Prefer small, focused diffs over rewriting the template.

## When docs drift

If you rename major folders, change the API surface, or add a new top-level area, update **CONTEXT.md** in the same change so the next turn stays accurate.
