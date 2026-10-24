export type CliEventType =
  | "text_chunk"
  | "thought"
  | "tool_call"
  | "tool_result"
  | "permission_request"
  | "artifact"
  | "status"
  | "error";

export interface CliEvent<T = unknown> {
  type: CliEventType;
  sessionId: string;
  timestamp: string;
  data: T;
}

export function createCliEvent<T = unknown>(
  type: CliEventType,
  sessionId: string,
  data: T,
  timestamp: string = new Date().toISOString()
): CliEvent<T> {
  return {
    type,
    sessionId,
    timestamp,
    data,
  };
}

export interface TextChunkEventData {
  text: string;
  delta?: boolean;
}

export interface ThoughtEventData {
  thought: string;
  delta?: boolean;
}

export interface ToolCallEventData {
  id: string;
  name: string;
  arguments: Record<string, unknown> | string;
  toolSummary?: string;
}

export interface ToolResultEventData {
  toolCallId: string;
  name: string;
  output?: string;
  error?: string;
  isError?: boolean;
}

export interface PermissionRequestEventData {
  id: string;
  toolName: string;
  details: Record<string, unknown>;
  defaultBehavior?: "allow" | "deny";
}

export interface StatusEventData {
  status: "starting" | "thinking" | "executing_tool" | "waiting_for_input" | "idle" | "done" | "error";
  message?: string;
}

export interface ArtifactEventData {
  path: string;
  summary?: string;
  action: "created" | "updated" | "deleted";
}

export interface ErrorEventData {
  error: string;
  code?: string | number;
}
