# AGENT.md — Working in this workspace

Read **CONTEXT.md** first for the project map. Do **not** re-scan the whole tree for stack, ports, or layout unless those docs are missing or clearly outdated.

## Non‑negotiable stack

| Layer | Must use |
|--------|----------|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS v4 |
| UI | shadcn/ui under `src/components/ui/` |
| Backend | Express.js + TypeScript |
| Data | In-memory mock DB (`server/db/mockDb.ts`) — no external DB |
| Package manager | **npm** |

Do not switch frameworks, languages, CSS systems, or package managers. If the user asks for something conflicting, keep this stack and still implement the feature.

## UI components (mandatory)

**Installed now:** `Button`, `Card` (+ header/title/description/content/footer), `Badge`, `Input`.

1. Prefer these installed components before inventing custom markup.
2. Follow the **shadcn skill** for composition and styling (`gap-*` not `space-y-*`, semantic colors, `data-icon` on Button icons, full Card composition, etc.).
3. Need another shadcn primitive (e.g. `Separator`, `Tabs`)? Add it with:
   ```bash
   npx shadcn@latest add <component>
   ```
   then use it. Do not hand-roll a substitute.
4. Do **not** rewrite existing `src/components/ui/*` mid-feature to chase skill purity — they are already skill-aligned. Build the product with them.

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
npm run dev           # client + server together
npm run dev:client    # Vite only
npm run dev:server    # Express only
npm install <pkg>     # add npm dependency
npx shadcn@latest add <component>
```

### `docker_bash` tool

- Pass **only** `command` (and optionally `timeout` / `is_background`).
- Do **not** pass a container ID or workdir — this workspace sandbox and `/app` are already bound.
- Example: `{ "command": "ls" }` or `{ "command": "npm install framer-motion", "timeout": 300 }`.

All project shell work runs in `/app` inside the sandbox.

## Installing npm packages (do this correctly once)

When you need a library (e.g. `framer-motion`):

1. `docker_bash`: `{ "command": "npm install <package>", "timeout": 300 }`  
   (container + `/app` are already bound — do not pass them.)
2. **Verify once:** `{ "command": "test -d node_modules/<package> && echo ok" }`.
3. If install fails: read stderr, fix the cause, retry **once**. Do not reinstall blindly in a loop.
4. Then continue the feature. Do not keep reopening AGENT/CONTEXT/ui primitives after a successful install.

## How to build features

1. **UI** — Compose with installed shadcn components; add via CLI only when needed. Use the `@/` alias.
2. **Pages** — Start from `src/App.tsx`. Prefer **small files** under `src/components/` over one huge App rewrite (avoids truncated writes).
3. **API** — Routes in `server/routes/api.ts` (or new routers from `server/index.ts`). Paths under `/api/...`.
4. **Data** — Extend `server/db/schema.ts`, seed in `server/db/seed.ts`, use `db.collection(...)` from `mockDb.ts`.
5. **Frontend ↔ API** — Call `/api/...` via the Vite proxy. Do not hardcode host ports in the UI.

## UX / preview rules

- Users see this app in an iframe preview. Do **not** display internal port numbers or infrastructure details in the UI.
- Keep copy product-facing (“API connected”, “Online”), not “Port 4000 / 3000”.

## Efficiency

- Trust CONTEXT.md for structure; open files only when you need to change them.
- After meaningful changes, keep `npm run dev` running (or restart) so the preview updates.
- Prefer small, focused diffs. One install → one verify → build the feature.

## When docs drift

If you rename major folders, change the API surface, or add a new top-level area, update **CONTEXT.md** in the same change so the next turn stays accurate.
