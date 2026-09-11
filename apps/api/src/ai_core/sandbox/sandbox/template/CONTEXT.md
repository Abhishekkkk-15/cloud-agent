# CONTEXT.md — Project snapshot

Quick reference for this Cloud Agent sandbox workspace. Working directory in the container: `/app`.

## What this is

A **fullstack starter** already wired for the sandbox:

- **Frontend:** Vite + React 18 + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Backend:** Express + TypeScript (`tsx`)
- **Storage:** In-memory mock database (not a real DB)

Dev command `pnpm dev` runs both processes via `concurrently`.

## Directory map

```
/app
├── AGENT.md                 # Agent rules (read first)
├── CONTEXT.md               # This file
├── package.json             # Scripts + deps (pnpm)
├── components.json          # shadcn config
├── index.html
├── vite.config.ts           # Alias @ → src; port 4000; /api proxy
├── tsconfig.json            # Includes src + server
├── src/
│   ├── main.tsx             # React entry + sonner toaster
│   ├── App.tsx              # Main UI (status cards + tasks demo)
│   ├── styles.css           # Tailwind + CSS variables
│   ├── lib/utils.ts         # cn() helper
│   └── components/ui/       # shadcn: button, card, badge, input, …
└── server/
    ├── index.ts             # Express app, listen 0.0.0.0:3000
    ├── routes/api.ts        # /api/health, /api/items, /api/db/stats
    └── db/
        ├── mockDb.ts        # In-memory CRUD + latency
        ├── schema.ts        # Item, User types
        └── seed.ts          # Initial data
```

## Runtime wiring

| Process | Bind | Role |
|---------|------|------|
| Vite | `0.0.0.0:4000` | Serves UI; proxies `/api` → backend |
| Express | `0.0.0.0:3000` | JSON API under `/api` |

Preview/proxy infrastructure outside this app maps host traffic to these binds. **Do not change ports** unless system instructions allow it.

### Vite notes (`vite.config.ts`)

- Alias: `@/*` → `./src/*`
- `server.watch.usePolling: true` (required in Docker)
- `proxy['/api']` → `http://localhost:3000`

## Frontend entry points

| File | Role |
|------|------|
| `src/main.tsx` | Mounts `<App />`, Sonner toasts |
| `src/App.tsx` | Demo: health/status cards + items CRUD UI |
| `src/styles.css` | Design tokens + Tailwind import |
| `src/components/ui/*` | shadcn primitives — prefer these |

Import UI with: `import { Button } from '@/components/ui/button'`.

## Backend API (current)

Base path: **`/api`** (from browser via Vite proxy).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | `{ status, uptime, database }` |
| GET | `/api/db/stats` | Mock DB stats |
| GET | `/api/items` | List items |
| POST | `/api/items` | Create `{ title, description?, category? }` |
| PUT | `/api/items/:id` | Update fields (e.g. `completed`) |
| DELETE | `/api/items/:id` | Delete item |

Root `GET /` on the Express server returns a small JSON index (not used by the Vite UI).

## Data model (mock)

Defined in `server/db/schema.ts`:

- **Item:** `id`, `title`, `description?`, `completed`, `category` (`feature` \| `bug` \| `task`), timestamps
- **User:** seeded users exist; items CRUD is the main demo surface

Access pattern:

```ts
import { db } from './db/mockDb'
await db.collection('items').find()
await db.collection('items').create({ ... })
await db.collection('items').update(id, { ... })
await db.collection('items').delete(id)
```

## Scripts (`package.json`)

| Script | What it runs |
|--------|----------------|
| `pnpm dev` | Vite `:4000` + `tsx watch server/index.ts` |
| `pnpm dev:client` | Vite only |
| `pnpm dev:server` | Express only |
| `pnpm build` | `tsc -b && vite build` |

## Dependencies worth knowing

- UI: `react`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `sonner`
- Style: `tailwindcss`, `@tailwindcss/vite`
- API: `express`, `cors`
- Tooling: `vite`, `@vitejs/plugin-react`, `tsx`, `concurrently`, `typescript`

## Suggested first edits for a new feature

1. Types / seed → `server/db/schema.ts`, `seed.ts`
2. Routes → `server/routes/api.ts`
3. UI → `src/App.tsx` or new components under `src/components/`
4. Reuse / add shadcn under `src/components/ui/`

Keep this file updated when the map above changes.
