import {
  type CliEvent,
  createCliEvent,
  type TextChunkEventData,
  type ThoughtEventData,
  type ToolCallEventData,
  type ToolResultEventData,
  type StatusEventData,
  type ErrorEventData,
} from "@cloud-agent/cli-interface";

/**
 * Maps incoming stream-json NDJSON payloads from the Antigravity CLI process
 * into normalized `CliEvent` instances.
 */
export function mapAntigravityStreamEvent(
  sessionId: string,
  raw: Record<string, unknown>
): CliEvent[] {
  const events: CliEvent[] = [];

  // Antigravity Native Event envelope: { event: string, ... }
  if (typeof raw.event === "string") {
    const eventType = raw.event;

    // 1. Init event
    if (eventType === "init") {
      const convId = (raw.conversation_id as string) || sessionId;
      events.push(
        createCliEvent<StatusEventData>("status", convId, {
          status: "idle",
          message: "Antigravity initialized",
        })
      );
      return events;
    }

    // 2. Step Update event (streaming text/thought/tools)
    if (eventType === "step_update" && raw.step_update && typeof raw.step_update === "object") {
      const su = raw.step_update as Record<string, unknown>;
      const convId = (su.conversation_id as string) || sessionId;

      // Text delta
      if (typeof su.text_delta === "string" && su.text_delta.length > 0) {
        events.push(
          createCliEvent<TextChunkEventData>("text_chunk", convId, {
            text: su.text_delta,
            delta: true,
          })
        );
      }

      // Thought / reasoning delta
      if (typeof su.thought_delta === "string" && su.thought_delta.length > 0) {
        events.push(
          createCliEvent<ThoughtEventData>("thought", convId, {
            thought: su.thought_delta,
            delta: true,
          })
        );
      } else if (typeof su.thinking === "string" && su.thinking.length > 0) {
        events.push(
          createCliEvent<ThoughtEventData>("thought", convId, {
            thought: su.thinking,
            delta: false,
          })
        );
      }

      // Tool Call
      if (su.tool_call && typeof su.tool_call === "object") {
        const tc = su.tool_call as { id?: string; name?: string; args?: unknown };
        events.push(
          createCliEvent<ToolCallEventData>("tool_call", convId, {
            id: tc.id || `tc_${Date.now()}`,
            name: tc.name || "unknown",
            arguments: (tc.args as Record<string, unknown>) || {},
          })
        );
      }

      // Tool Result
      if (su.tool_result && typeof su.tool_result === "object") {
        const tr = su.tool_result as { tool_call_id?: string; name?: string; output?: string; error?: string };
        events.push(
          createCliEvent<ToolResultEventData>("tool_result", convId, {
            toolCallId: tr.tool_call_id || "tool",
            name: tr.name || "",
            output: tr.output,
            error: tr.error,
            isError: Boolean(tr.error),
          })
        );
      }

      return events;
    }

    // 3. Result event (turn finished or errored)
    if (eventType === "result" && raw.result && typeof raw.result === "object") {
      const res = raw.result as Record<string, unknown>;
      const convId = (res.conversation_id as string) || sessionId;

      if (res.status === "ERROR") {
        events.push(
          createCliEvent<ErrorEventData>("error", convId, {
            error: (res.error as string) || "Unknown Antigravity error",
          })
        );
      } else {
        events.push(
          createCliEvent<StatusEventData>("status", convId, {
            status: "done",
            message: "Turn completed successfully",
          })
        );
      }

      return events;
    }
  }

  // Fallback parsers for generic structures:
  // Text chunk / Content
  if (typeof raw.text === "string" && raw.text.length > 0) {
    events.push(
      createCliEvent<TextChunkEventData>("text_chunk", sessionId, {
        text: raw.text,
        delta: raw.delta === true || raw.type === "chunk",
      })
    );
  }

  // Thought
  if (typeof raw.thought === "string" && raw.thought.length > 0) {
    events.push(
      createCliEvent<ThoughtEventData>("thought", sessionId, {
        thought: raw.thought,
        delta: true,
      })
    );
  }

  // Tool calls array
  if (Array.isArray(raw.tool_calls)) {
    for (let i = 0; i < raw.tool_calls.length; i++) {
      const tc = raw.tool_calls[i] as { name?: string; args?: unknown };
      if (tc && tc.name) {
        events.push(
          createCliEvent<ToolCallEventData>("tool_call", sessionId, {
            id: `${tc.name}_${Date.now()}_${i}`,
            name: tc.name,
            arguments: (tc.args as Record<string, unknown>) || {},
          })
        );
      }
    }
  }

  return events;
}
