export type CliRole = "user" | "assistant" | "system" | "tool";

export interface CliAvailability {
  available: boolean;
  version?: string;
  binaryPath?: string;
  error?: string;
}

export interface CliPaginationOptions {
  /** Maximum number of items to return (default: 50) */
  limit?: number;
  /** Number of items to skip (default: 0) */
  offset?: number;
  /** Sort order: "desc" (most recent first) or "asc" (chronological). Default: "asc" for chat, "desc" for sessions */
  order?: "asc" | "desc";
}

export interface CliPaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

export interface CliSessionSummary {
  id: string;
  title: string;
  workspacePath: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  status?: "active" | "idle" | "completed" | "error";
  model?: string;
  pinned?: boolean;
}

export interface CliToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown> | string;
}

export interface CliMessage {
  id?: string;
  role: CliRole;
  content: string;
  timestamp: string;
  name?: string;
  reasoning?: string;
  toolCalls?: CliToolCall[];
  toolCallId?: string;
}

export interface CliArtifact {
  id: string;
  path: string;
  title?: string;
  summary?: string;
  language?: string;
  content?: string;
}

export interface CliSessionListOptions extends CliPaginationOptions {
  workspaceFilter?: string;
}

export interface CliGetSessionOptions extends CliPaginationOptions {
  includeArtifacts?: boolean;
}

export interface CliSessionDetail extends CliSessionSummary {
  messages: CliMessage[];
  totalMessages: number;
  hasMoreMessages: boolean;
  artifacts?: CliArtifact[];
}

export type CliEffortLevel = "low" | "medium" | "high" | "xhigh" | "max";
export type CliExecutionMode = "auto" | "plan" | "accept-edits";

export interface CliRunOptions {
  prompt: string;
  sessionId?: string;
  cwd: string;
  model?: string;
  effort?: CliEffortLevel;
  mode?: CliExecutionMode;
  dangerouslySkipPermissions?: boolean;
  env?: Record<string, string>;
}

export interface CliPtyOptions {
  cols: number;
  rows: number;
  cwd: string;
  env?: Record<string, string>;
  args?: string[];
}

export interface CliPtyProcess {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
  onData(callback: (data: string) => void): { dispose: () => void };
  onExit(callback: (exitCode: number, signal?: number) => void): { dispose: () => void };
}
