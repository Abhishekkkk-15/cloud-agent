# packages/cli-interface — Architectural Context

`packages/cli-interface` defines the shared, strongly-typed contracts, event models, and abstract interfaces implemented by all CLI coding agent adapters in the Cloud Agent monorepo.

---

## 🔑 Core Types & Exports

- **`ICliAdapter`**: Core interface providing `checkAvailability`, `listSessions`, `getSession`, and `run`.
- **`CliEvent`**: Discriminated union of execution events: `text_chunk`, `thought`, `tool_call`, `tool_result`, `status`, `error`.
- **`CliSessionSummary` & `CliMessage`**: Standardized session and message representations.
- **`CliPaginatedResult<T>`**: Standardized cursor and offset-based pagination contract.
