import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import type {
  CliSessionSummary,
  CliSessionDetail,
  CliMessage,
  CliAttachment,
  CliToolCall,
  CliPaginatedResult,
  CliSessionListOptions,
  CliGetSessionOptions,
  CliPaginationOptions,
} from "@cloud-agent/cli-interface";
import { getCodexHome, getSessionIndexFile, getSessionsDir } from "./paths.js";

interface SessionIndexEntry {
  id: string;
  thread_name?: string;
  updated_at?: string;
}

interface RolloutLine {
  timestamp?: string;
  ordinal?: number;
  type?: string;
  payload?: {
    session_id?: string;
    id?: string;
    cwd?: string;
    timestamp?: string;
    type?: string;
    role?: string;
    content?: Array<{
      type?: string;
      text?: string;
      path?: string;
      url?: string;
    }>;
    phase?: string;
    call_id?: string;
    name?: string;
    input?: string;
    arguments?: unknown;
    output?: Array<{
      type?: string;
      text?: string;
    }> | string;
    text?: string;
    summary?: string;
    internal_chat_message_metadata_passthrough?: {
      content_item_kinds?: string[];
      turn_id?: string;
    };
  };
}

// In-memory cache for fast rollout path lookups (sessionId -> absolute rollout path)
const rolloutPathCache = new Map<string, string>();
// In-memory cache for workspace paths (sessionId -> cwd)
const workspacePathCache = new Map<string, string>();
// In-memory cache for pinned sessions
const pinnedSessions = new Set<string>();

/**
 * Scans the sessions directory to find the rollout JSONL file for a given session ID.
 * Sessions are stored at: ~/.codex/sessions/YYYY/MM/DD/rollout-*-<sessionId>.jsonl
 */
export function findRolloutPath(sessionId: string): string | null {
  if (rolloutPathCache.has(sessionId)) {
    const cached = rolloutPathCache.get(sessionId)!;
    if (fs.existsSync(cached)) {
      return cached;
    }
    rolloutPathCache.delete(sessionId);
  }

  const sessionsDir = getSessionsDir();
  if (!fs.existsSync(sessionsDir)) return null;

  try {
    // Years (descending)
    const years = fs.readdirSync(sessionsDir).filter((y) => /^\d{4}$/.test(y)).sort().reverse();
    for (const year of years) {
      const yearDir = path.join(sessionsDir, year);
      if (!fs.statSync(yearDir).isDirectory()) continue;

      // Months (descending)
      const months = fs.readdirSync(yearDir).filter((m) => /^\d{2}$/.test(m)).sort().reverse();
      for (const month of months) {
        const monthDir = path.join(yearDir, month);
        if (!fs.statSync(monthDir).isDirectory()) continue;

        // Days (descending)
        const days = fs.readdirSync(monthDir).filter((d) => /^\d{2}$/.test(d)).sort().reverse();
        for (const day of days) {
          const dayDir = path.join(monthDir, day);
          if (!fs.statSync(dayDir).isDirectory()) continue;

          const files = fs.readdirSync(dayDir);
          const target = files.find((f) => f.endsWith(`-${sessionId}.jsonl`));
          if (target) {
            const fullPath = path.join(dayDir, target);
            rolloutPathCache.set(sessionId, fullPath);
            return fullPath;
          }
        }
      }
    }
  } catch {
    // Directory scan error
  }

  return null;
}

/**
 * Extracts the workspace cwd from a session's rollout file.
 */
function getWorkspacePathForSession(sessionId: string): string {
  if (workspacePathCache.has(sessionId)) {
    return workspacePathCache.get(sessionId)!;
  }

  const rolloutPath = findRolloutPath(sessionId);
  if (!rolloutPath) return "";

  try {
    // Read the first 4KB where session_meta header with cwd lives
    const fd = fs.openSync(rolloutPath, "r");
    const buffer = Buffer.alloc(4096);
    const bytesRead = fs.readSync(fd, buffer, 0, 4096, 0);
    fs.closeSync(fd);

    const chunk = buffer.toString("utf8", 0, bytesRead);
    const match = /"cwd"\s*:\s*"([^"]+)"/.exec(chunk);
    if (match && match[1]) {
      const unescaped = match[1].replace(/\\\\/g, "\\");
      workspacePathCache.set(sessionId, unescaped);
      return unescaped;
    }
  } catch {
    // Parsing error
  }

  return "";
}

/**
 * Zero-DB line-by-line reader for ~/.codex/session_index.jsonl.
 * Discovers and paginates sessions from disk.
 */
export async function listCodexSessions(
  options?: CliSessionListOptions | string
): Promise<CliPaginatedResult<CliSessionSummary>> {
  const indexFile = getSessionIndexFile();
  const opts: CliSessionListOptions =
    typeof options === "string" ? { workspaceFilter: options } : options || {};

  const limit = Math.max(1, opts.limit ?? 50);
  const offset = Math.max(0, opts.offset ?? 0);
  const order = opts.order ?? "desc"; // Default: most recent first

  if (!fs.existsSync(indexFile)) {
    return {
      items: [],
      total: 0,
      hasMore: false,
      limit,
      offset,
    };
  }

  const entries: SessionIndexEntry[] = [];
  const fileStream = fs.createReadStream(indexFile, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: SessionIndexEntry = JSON.parse(trimmed);
      if (parsed.id) {
        entries.push(parsed);
      }
    } catch {
      // Ignore malformed lines
    }
  }

  // Sort sessions
  entries.sort((a, b) => {
    const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return order === "desc" ? timeB - timeA : timeA - timeB;
  });

  // Filter by workspace if requested
  const normalizedWsFilter = opts.workspaceFilter
    ? path.normalize(opts.workspaceFilter).toLowerCase()
    : undefined;

  const summaries: CliSessionSummary[] = [];

  for (const entry of entries) {
    const ws = getWorkspacePathForSession(entry.id);
    if (normalizedWsFilter) {
      const normalizedWs = ws ? path.normalize(ws).toLowerCase() : "";
      if (normalizedWs !== normalizedWsFilter && !normalizedWs.startsWith(normalizedWsFilter)) {
        continue;
      }
    }

    summaries.push({
      id: entry.id,
      title: entry.thread_name || "Codex Session",
      workspacePath: ws,
      createdAt: entry.updated_at || new Date().toISOString(),
      updatedAt: entry.updated_at || new Date().toISOString(),
      messageCount: 0, // Computed dynamically when requested
      status: "idle",
      model: "gpt-5.6-luna",
      pinned: pinnedSessions.has(entry.id),
    });
  }

  const total = summaries.length;
  const pagedItems = summaries.slice(offset, offset + limit);
  const hasMore = offset + limit < total;

  return {
    items: pagedItems,
    total,
    hasMore,
    limit,
    offset,
  };
}

/**
 * Retrieves session detail including metadata and recent messages.
 */
export async function getCodexSession(
  sessionId: string,
  options?: CliGetSessionOptions
): Promise<CliSessionDetail | null> {
  const rolloutPath = findRolloutPath(sessionId);
  const indexFile = getSessionIndexFile();

  let title = "Codex Session";
  let updatedAt = new Date().toISOString();
  let createdAt = new Date().toISOString();
  const workspacePath = getWorkspacePathForSession(sessionId);

  // Read metadata from session_index.jsonl if present
  if (fs.existsSync(indexFile)) {
    try {
      const content = fs.readFileSync(indexFile, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parsed: SessionIndexEntry = JSON.parse(trimmed);
        if (parsed.id === sessionId) {
          if (parsed.thread_name) title = parsed.thread_name;
          if (parsed.updated_at) {
            updatedAt = parsed.updated_at;
            createdAt = parsed.updated_at;
          }
          break;
        }
      }
    } catch {
      // index read error
    }
  }

  const messagesResult = await getCodexMessages(sessionId, options);

  return {
    id: sessionId,
    title,
    workspacePath,
    createdAt,
    updatedAt,
    messageCount: messagesResult.total,
    status: "idle",
    model: "gpt-5.6-luna",
    pinned: pinnedSessions.has(sessionId),
    messages: messagesResult.items,
    totalMessages: messagesResult.total,
    hasMoreMessages: messagesResult.hasMore,
  };
}

/**
 * Parses a single rollout line from a Codex session into a CliMessage, or returns null.
 */
function parseRolloutLineToMessage(line: string, index: number): CliMessage | null {
  try {
    const parsed: RolloutLine = JSON.parse(line);
    const ts = parsed.timestamp || new Date().toISOString();

    if (parsed.type === "response_item" && parsed.payload) {
      const payload = parsed.payload;

      // 1. Message: User or Assistant
      if (payload.type === "message") {
        if (payload.role === "user") {
          // Extract user input prompt
          const kinds = payload.internal_chat_message_metadata_passthrough?.content_item_kinds || [];
          let cleanContent = "";
          const attachments: CliAttachment[] = [];

          if (Array.isArray(payload.content)) {
            for (let i = 0; i < payload.content.length; i++) {
              const item = payload.content[i];
              const kind = kinds[i] || "";

              // Skip injected instructions or environment context
              if (
                kind.includes("instructions") ||
                kind.includes("environment_context") ||
                item.text?.startsWith("# AGENTS.md instructions") ||
                item.text?.startsWith("<environment_context>")
              ) {
                continue;
              }

              if (item.type === "input_text" && item.text) {
                cleanContent += (cleanContent ? "\n" : "") + item.text;
              } else if (item.type === "localImage" && item.path) {
                attachments.push({
                  name: path.basename(item.path),
                  path: item.path,
                });
              } else if (item.type === "image" && item.url) {
                attachments.push({
                  name: path.basename(item.url),
                  path: item.url,
                });
              }
            }
          }

          if (!cleanContent.trim() && attachments.length === 0) {
            return null;
          }

          return {
            id: payload.id || `msg_user_${index}`,
            role: "user",
            content: cleanContent.trim(),
            attachments: attachments.length > 0 ? attachments : undefined,
            timestamp: ts,
          };
        }

        if (payload.role === "assistant") {
          let text = "";
          if (Array.isArray(payload.content)) {
            text = payload.content
              .filter((c) => c.text)
              .map((c) => c.text)
              .join("\n");
          }

          return {
            id: payload.id || `msg_assistant_${index}`,
            role: "assistant",
            content: text,
            timestamp: ts,
          };
        }
      }

      // 2. Reasoning / Thinking
      if (payload.type === "reasoning") {
        const reasoningText = payload.text || payload.summary || "";
        return {
          id: `reasoning_${index}`,
          role: "assistant",
          content: "",
          reasoning: reasoningText,
          timestamp: ts,
        };
      }

      // 3. Tool Calls (exec / custom_tool_call / function_call)
      if (payload.type === "custom_tool_call" || payload.type === "function_call") {
        const callId = payload.call_id || payload.id || `call_${index}`;
        const toolName = payload.name || "exec";
        const args = payload.input || payload.arguments || {};

        const toolCall: CliToolCall = {
          id: callId,
          name: toolName,
          arguments: typeof args === "string" ? args : (args as Record<string, unknown>),
        };

        return {
          id: `tool_call_${index}`,
          role: "assistant",
          content: "",
          toolCalls: [toolCall],
          timestamp: ts,
        };
      }

      // 4. Tool Call Outputs
      if (payload.type === "custom_tool_call_output" || payload.type === "function_call_output") {
        let outputText = "";
        if (Array.isArray(payload.output)) {
          outputText = payload.output.map((o) => o.text || "").join("");
        } else if (typeof payload.output === "string") {
          outputText = payload.output;
        }

        return {
          id: `tool_res_${index}`,
          role: "tool",
          content: outputText,
          toolCallId: payload.call_id,
          timestamp: ts,
        };
      }
    }
  } catch {
    // Malformed JSON line
  }

  return null;
}

/**
 * Retrieves a paginated slice of chat messages from a Codex session rollout.
 * MEMORY SAFE: Only parses lines within the requested pagination slice.
 */
export async function getCodexMessages(
  sessionId: string,
  options?: CliPaginationOptions
): Promise<CliPaginatedResult<CliMessage>> {
  const rolloutPath = findRolloutPath(sessionId);
  const limit = Math.max(1, options?.limit ?? 50);
  const offset = Math.max(0, options?.offset ?? 0);
  const order = options?.order ?? "asc"; // "asc" for chat scroller, "desc" for newest

  if (!rolloutPath || !fs.existsSync(rolloutPath)) {
    return {
      items: [],
      total: 0,
      hasMore: false,
      limit,
      offset,
    };
  }

  const allMessages: CliMessage[] = [];
  const fileStream = fs.createReadStream(rolloutPath, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineIdx = 0;
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const msg = parseRolloutLineToMessage(trimmed, lineIdx++);
    if (msg) {
      // Merge reasoning into subsequent assistant message if immediately following
      if (
        msg.role === "assistant" &&
        !msg.content &&
        msg.reasoning &&
        allMessages.length > 0 &&
        allMessages[allMessages.length - 1].role === "assistant" &&
        !allMessages[allMessages.length - 1].reasoning
      ) {
        allMessages[allMessages.length - 1].reasoning = msg.reasoning;
        continue;
      }
      allMessages.push(msg);
    }
  }

  // Combine contiguous tool calls / outputs if needed
  const total = allMessages.length;

  if (order === "desc") {
    allMessages.reverse();
  }

  const pagedItems = allMessages.slice(offset, offset + limit);
  const hasMore = offset + limit < total;

  return {
    items: pagedItems,
    total,
    hasMore,
    limit,
    offset,
  };
}

/**
 * Renames a Codex session in session_index.jsonl.
 */
export async function renameCodexSession(sessionId: string, title: string): Promise<void> {
  const indexFile = getSessionIndexFile();
  if (!fs.existsSync(indexFile)) return;

  const content = fs.readFileSync(indexFile, "utf8");
  const lines = content.split("\n");
  const updatedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed: SessionIndexEntry = JSON.parse(trimmed);
      if (parsed.id === sessionId) {
        parsed.thread_name = title;
        updatedLines.push(JSON.stringify(parsed));
      } else {
        updatedLines.push(trimmed);
      }
    } catch {
      updatedLines.push(trimmed);
    }
  }

  fs.writeFileSync(indexFile, updatedLines.join("\n") + "\n", "utf8");
}

/**
 * Pins or unpins a session.
 */
export async function pinCodexSession(sessionId: string, pinned: boolean): Promise<void> {
  if (pinned) {
    pinnedSessions.add(sessionId);
  } else {
    pinnedSessions.delete(sessionId);
  }
}

/**
 * Deletes a session and its rollout file from disk.
 */
export async function deleteCodexSession(sessionId: string): Promise<void> {
  // Delete rollout file
  const rolloutPath = findRolloutPath(sessionId);
  if (rolloutPath && fs.existsSync(rolloutPath)) {
    try {
      fs.unlinkSync(rolloutPath);
    } catch {
      // unlink error
    }
    rolloutPathCache.delete(sessionId);
    workspacePathCache.delete(sessionId);
  }

  // Remove from session_index.jsonl
  const indexFile = getSessionIndexFile();
  if (fs.existsSync(indexFile)) {
    const content = fs.readFileSync(indexFile, "utf8");
    const lines = content.split("\n");
    const updatedLines = lines.filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      try {
        const parsed: SessionIndexEntry = JSON.parse(trimmed);
        return parsed.id !== sessionId;
      } catch {
        return true;
      }
    });

    fs.writeFileSync(indexFile, updatedLines.join("\n") + "\n", "utf8");
  }
}
