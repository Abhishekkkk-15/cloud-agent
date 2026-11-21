import {
  type CliEvent,
  type CliMessage,
  type CliToolCall,
  type CliAttachment,
  createCliEvent,
} from "@cloud-agent/cli-interface";
import path from "node:path";

export interface CodexLiveEvent {
  type?: string;
  thread_id?: string;
  item?: {
    id?: string;
    type?: string;
    text?: string;
    summary?: string;
    command?: string;
    output?: string;
    exit_code?: number;
    call_id?: string;
    name?: string;
    arguments?: unknown;
  };
  usage?: {
    input_tokens?: number;
    cached_input_tokens?: number;
    output_tokens?: number;
    reasoning_output_tokens?: number;
  };
  error?: string | { message?: string };
}

/**
 * Maps a single newline-delimited JSON line from `codex exec --json` stdout
 * into zero or more normalized `CliEvent` instances.
 */
export function mapCodexStreamEvent(
  rawLine: string,
  currentSessionId: string
): { events: CliEvent[]; detectedSessionId?: string } {
  const trimmed = rawLine.trim();
  if (!trimmed || !trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return { events: [] };
  }

  try {
    const data: CodexLiveEvent = JSON.parse(trimmed);
    const events: CliEvent[] = [];
    let detectedSessionId: string | undefined;

    // 1. Thread started / session identification
    if (data.type === "thread.started" && data.thread_id) {
      detectedSessionId = data.thread_id;
      events.push(
        createCliEvent("status", detectedSessionId, {
          status: "starting",
          message: "Codex thread initialized",
        })
      );
      return { events, detectedSessionId };
    }

    const effectiveSessionId = detectedSessionId || currentSessionId;

    // 2. Turn started
    if (data.type === "turn.started") {
      events.push(
        createCliEvent("status", effectiveSessionId, {
          status: "thinking",
        })
      );
      return { events };
    }

    // 3. Item started (e.g. tool execution starting or thinking)
    if (data.type === "item.started" && data.item) {
      if (data.item.type === "command_execution" && data.item.command) {
        events.push(
          createCliEvent("status", effectiveSessionId, {
            status: "executing_tool",
            message: data.item.command,
          })
        );
        events.push(
          createCliEvent("tool_call", effectiveSessionId, {
            id: data.item.id || `tool_${Date.now()}`,
            name: "shell",
            arguments: { command: data.item.command },
            toolSummary: data.item.command,
          })
        );
      }
      return { events };
    }

    // 4. Item completed
    if (data.type === "item.completed" && data.item) {
      const item = data.item;

      // Agent message / text response
      if (item.type === "agent_message" && item.text) {
        events.push(
          createCliEvent("text_chunk", effectiveSessionId, {
            text: item.text,
            delta: false,
          })
        );
      }

      // Chain-of-thought reasoning
      else if (item.type === "reasoning" && (item.text || item.summary)) {
        events.push(
          createCliEvent("thought", effectiveSessionId, {
            thought: item.text || item.summary || "",
            delta: false,
          })
        );
      }

      // Command execution tool result
      else if (item.type === "command_execution") {
        events.push(
          createCliEvent("tool_result", effectiveSessionId, {
            toolCallId: item.id || `tool_${Date.now()}`,
            name: "shell",
            output: item.output || "",
            isError: typeof item.exit_code === "number" && item.exit_code !== 0,
          })
        );
      }
      return { events };
    }

    // 5. Turn completed
    if (data.type === "turn.completed") {
      events.push(
        createCliEvent("status", effectiveSessionId, {
          status: "done",
        })
      );
      return { events };
    }

    // 6. Error event
    if (data.type === "error" || data.error) {
      const msg = typeof data.error === "string" ? data.error : data.error?.message || "Codex error";
      events.push(
        createCliEvent("error", effectiveSessionId, {
          error: msg,
        })
      );
      return { events };
    }

    return { events };
  } catch {
    return { events: [] };
  }
}
