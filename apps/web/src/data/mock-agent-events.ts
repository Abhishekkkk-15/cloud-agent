import type { AgentEvent, ChatMessage } from "@cloud-agent/shared"

const sessionId = "sess_demo_cli_package"

function ev(
  id: string,
  type: AgentEvent["type"],
  data: AgentEvent["data"] = {}
): AgentEvent {
  return { id, type, data }
}

/** First assistant turn — rich event stream matching the product event table */
export const mockFirstTurnEvents: AgentEvent[] = [
  ev("e1", "RUN_STARTED", {
    prompt: "Ship this as a CLI package with docs and install checks.",
    session_id: sessionId,
  }),
  ev("e2", "USER_MESSAGE", {
    text: "Ship this as a CLI package with docs and install checks.",
  }),
  ev("e3", "THINKING", {
    text: "User wants a CLI package, not a web app. Plan: scaffold package layout, docs, then install + checks.",
  }),
  ev("e4", "STATUS", {
    message: "Inspecting workspace layout",
  }),
  ev("e5", "TOOL_CALL", {
    id: "call_read_pkg",
    name: "read_file",
    arguments: { path: "package.json" },
  }),
  ev("e6", "TOOL_RESULT", {
    id: "call_read_pkg",
    name: "read_file",
    content: '{ "name": "cloud-agent", "private": true }',
  }),
  ev("e7", "TOOL_CALL", {
    id: "call_edit_ws",
    name: "edit_file",
    arguments: { path: "pnpm-workspace.yaml" },
  }),
  ev("e8", "TOOL_RESULT", {
    id: "call_edit_ws",
    name: "edit_file",
    content: "Updated workspace packages list",
  }),
  ev("e9", "TOOL_CALL", {
    id: "call_create_pkg",
    name: "write_file",
    arguments: { path: "packages/env-detect/package.json" },
  }),
  ev("e10", "TOOL_RESULT", {
    id: "call_create_pkg",
    name: "write_file",
    content: "Created package.json",
  }),
  ev("e11", "TOOL_CALL", {
    id: "call_create_ts",
    name: "write_file",
    arguments: { path: "packages/env-detect/tsconfig.json" },
  }),
  ev("e12", "TOOL_CALL", {
    id: "call_create_types",
    name: "write_file",
    arguments: { path: "packages/env-detect/src/types.ts" },
  }),
  ev("e13", "TOOL_CALL", {
    id: "call_create_cli",
    name: "write_file",
    arguments: { path: "packages/env-detect/src/cli.ts" },
  }),
  ev("e14", "TOOL_CALL", {
    id: "call_create_readme",
    name: "write_file",
    arguments: { path: "packages/env-detect/README.md" },
  }),
  ev("e15", "PERMISSION_REQUEST", {
    tool: "bash",
    target: "pnpm install",
    details: "Install workspace dependencies",
  }),
  ev("e16", "TOOL_CALL", {
    id: "call_install",
    name: "bash",
    arguments: { command: "pnpm install" },
  }),
  ev("e17", "TOOL_RESULT", {
    id: "call_install",
    name: "bash",
    content: "Done in 4.2s",
  }),
  ev("e18", "TOOL_CALL", {
    id: "call_check",
    name: "bash",
    arguments: { command: "pnpm --filter @cloud-agent/env-detect typecheck" },
  }),
  ev("e19", "COMPACTION", {
    message: "Summarized earlier package.json exploration",
  }),
  ev("e20", "USAGE", {
    input_tokens: 18420,
    output_tokens: 2360,
  }),
  ev("e21", "TEXT", {
    text: "I've confirmed this should be delivered as a CLI package, not a web app. I'm adding the implementation and docs now, then I'll install the runtime dependencies and run the workspace checks.",
  }),
  ev("e22", "RUN_COMPLETED", {
    text: "CLI package scaffold complete",
    session_id: sessionId,
  }),
]

export const mockSecondTurnEvents: AgentEvent[] = [
  ev("e30", "RUN_STARTED", {
    prompt: "Also add a detect command for .env files.",
    session_id: sessionId,
  }),
  ev("e31", "THINKING", {
    text: "Extend the CLI with a detect subcommand that walks for .env* files.",
  }),
  ev("e32", "TOOL_CALL", {
    id: "call_read_cli",
    name: "read_file",
    arguments: { path: "packages/env-detect/src/cli.ts" },
  }),
  ev("e33", "TOOL_CALL", {
    id: "call_create_detect",
    name: "write_file",
    arguments: { path: "packages/env-detect/src/detect.ts" },
  }),
  ev("e34", "TOOL_CALL", {
    id: "call_edit_cli",
    name: "edit_file",
    arguments: { path: "packages/env-detect/src/cli.ts" },
  }),
  ev("e35", "STATUS", {
    message: "Retrying typecheck after rate limit",
  }),
  ev("e36", "TEXT", {
    text: "I'll add a `detect` command next and wire it into the CLI entrypoint so you can scan for `.env` files from the terminal.",
  }),
  ev("e37", "RUN_COMPLETED", {
    session_id: sessionId,
    text: "Detect command added",
  }),
]

export const mockChatSeed: ChatMessage[] = [
  {
    id: "c0",
    role: "user",
    content: "Ship this as a CLI package with docs and install checks.",
    createdAt: "2026-08-24T10:00:00.000Z",
  },
  {
    id: "c1",
    role: "assistant",
    content:
      "I've confirmed this should be delivered as a CLI package, not a web app. I'm adding the implementation and docs now, then I'll install the runtime dependencies and run the workspace checks.",
    createdAt: "2026-08-24T10:00:12.000Z",
    events: mockFirstTurnEvents,
  },
  {
    id: "c2",
    role: "user",
    content: "Also add a detect command for .env files.",
    createdAt: "2026-08-24T10:01:00.000Z",
  },
  {
    id: "c3",
    role: "assistant",
    content:
      "I'll add a `detect` command next and wire it into the CLI entrypoint so you can scan for `.env` files from the terminal.",
    createdAt: "2026-08-24T10:01:18.000Z",
    events: mockSecondTurnEvents,
  },
]
