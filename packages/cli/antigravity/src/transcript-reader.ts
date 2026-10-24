import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import type {
  CliSessionSummary,
  CliSessionDetail,
  CliMessage,
  CliArtifact,
  CliToolCall,
  CliPaginatedResult,
  CliSessionListOptions,
  CliGetSessionOptions,
  CliPaginationOptions,
} from "@cloud-agent/cli-interface";
import { getBrainDir } from "./paths.js";

interface TranscriptLine {
  step_index?: number;
  source?: string;
  type?: string;
  status?: string;
  created_at?: string;
  content?: string;
  thinking?: string;
  tool_calls?: Array<{
    name: string;
    args?: Record<string, unknown> | string;
  }>;
  truncated_fields?: string[];
}

/**
 * Extracts clean user prompt from raw transcript content.
 * Strips internal XML tags like <USER_REQUEST>, <ADDITIONAL_METADATA>, etc.
 */
export function extractUserPrompt(rawContent: string): string {
  const match = /<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/.exec(rawContent);
  if (match && match[1]) {
    return match[1].trim();
  }
  return (
    rawContent
      .replace(/<[A-Z_]+>[\s\S]*?<\/[A-Z_]+>/g, "")
      .trim() || rawContent.trim()
  );
}

function normalizeToolArgs(args: unknown): Record<string, unknown> | string {
  if (typeof args === "object" && args !== null) {
    const normalized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(args)) {
      if (typeof val === "string") {
        try {
          if ((val.startsWith("{") && val.endsWith("}")) || (val.startsWith("[") && val.endsWith("]"))) {
            normalized[key] = JSON.parse(val);
            continue;
          }
          if (val.startsWith('"') && val.endsWith('"')) {
            normalized[key] = JSON.parse(val);
            continue;
          }
        } catch {
          // keep as raw string
        }
      }
      normalized[key] = val;
    }
    return normalized;
  }
  return typeof args === "string" ? args : {};
}

/**
 * Lists sessions from disk with pagination and optional workspace filtering.
 * Zero-database: reads straight from ~/.gemini/antigravity-cli/brain.
 */
export async function listBrainSessions(
  options?: CliSessionListOptions | string
): Promise<CliPaginatedResult<CliSessionSummary>> {
  const brainDir = getBrainDir();
  if (!fs.existsSync(brainDir)) {
    return { items: [], total: 0, hasMore: false, limit: 50, offset: 0 };
  }

  const opts: CliSessionListOptions =
    typeof options === "string" ? { workspaceFilter: options } : options || {};

  const limit = Math.max(1, opts.limit ?? 50);
  const offset = Math.max(0, opts.offset ?? 0);
  const filter = opts.workspaceFilter ? path.normalize(opts.workspaceFilter).toLowerCase() : undefined;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(brainDir, { withFileTypes: true });
  } catch {
    return { items: [], total: 0, hasMore: false, limit, offset };
  }

  const summaries: CliSessionSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sessionId = entry.name;
    const sessionDir = path.join(brainDir, sessionId);
    const transcriptPath = path.join(sessionDir, ".system_generated", "logs", "transcript.jsonl");

    if (!fs.existsSync(transcriptPath)) continue;

    try {
      const stats = fs.statSync(transcriptPath);
      const summary = await extractSessionSummary(sessionId, sessionDir, transcriptPath, stats);

      if (summary) {
        if (filter && summary.workspacePath) {
          const normWs = path.normalize(summary.workspacePath).toLowerCase();
          if (!normWs.includes(filter) && !filter.includes(normWs)) {
            continue;
          }
        }
        summaries.push(summary);
      }
    } catch {
      // Ignore unreadable session folders gracefully
    }
  }

  // Sort by updatedAt descending (most recent sessions first)
  summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const total = summaries.length;
  const items = summaries.slice(offset, offset + limit);
  const hasMore = offset + limit < total;

  return {
    items,
    total,
    hasMore,
    limit,
    offset,
  };
}

async function extractSessionSummary(
  sessionId: string,
  sessionDir: string,
  transcriptPath: string,
  stats: fs.Stats
): Promise<CliSessionSummary | null> {
  const fileStream = fs.createReadStream(transcriptPath, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let title = `Session ${sessionId.slice(0, 8)}`;
  let createdAt = stats.birthtime.toISOString();
  let updatedAt = stats.mtime.toISOString();
  let messageCount = 0;
  let workspacePath = "";
  let model: string | undefined;
  let linesRead = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    messageCount++;
    linesRead++;

    try {
      const parsed: TranscriptLine = JSON.parse(line);

      if (parsed.created_at) {
        if (linesRead === 1) createdAt = parsed.created_at;
        updatedAt = parsed.created_at;
      }

      if (parsed.type === "USER_INPUT" && parsed.content && title.startsWith("Session ")) {
        const prompt = extractUserPrompt(parsed.content);
        if (prompt) {
          title = prompt.length > 80 ? `${prompt.slice(0, 77)}...` : prompt;
        }
        const modelMatch = /setting `Model Selection` from .*? to (.*?)\./.exec(parsed.content);
        if (modelMatch && modelMatch[1]) {
          model = modelMatch[1].trim();
        }
      }

      if (!workspacePath && parsed.tool_calls && parsed.tool_calls.length > 0) {
        for (const tc of parsed.tool_calls) {
          if (tc.args && typeof tc.args === "object") {
            const rawArgs = tc.args as Record<string, unknown>;
            const dir = (rawArgs.DirectoryPath || rawArgs.SearchPath || rawArgs.AbsolutePath) as string | undefined;
            if (dir && typeof dir === "string") {
              const clean = dir.replace(/^"|"$/g, "");
              if (clean.includes("/") || clean.includes("\\")) {
                workspacePath = path.isAbsolute(clean) ? clean : path.dirname(clean);
                break;
              }
            }
          }
        }
      }
    } catch {
      // Continue line iteration
    }
  }

  return {
    id: sessionId,
    title,
    workspacePath,
    createdAt,
    updatedAt,
    messageCount,
    status: "idle",
    model,
  };
}

/**
 * Parses a single transcript line into a CliMessage, or returns null if not a message step.
 */
function parseTranscriptLineToMessage(line: string, index: number): CliMessage | null {
  try {
    const parsed: TranscriptLine = JSON.parse(line);
    const ts = parsed.created_at || new Date().toISOString();

    if (parsed.type === "USER_INPUT") {
      const clean = extractUserPrompt(parsed.content || "");
      return {
        id: `step_${parsed.step_index ?? index}`,
        role: "user",
        content: clean,
        timestamp: ts,
      };
    }

    if (parsed.type === "PLANNER_RESPONSE") {
      const toolCalls: CliToolCall[] = (parsed.tool_calls || []).map((tc, idx) => ({
        id: `${tc.name}_${parsed.step_index ?? index}_${idx}`,
        name: tc.name,
        arguments: normalizeToolArgs(tc.args),
      }));

      return {
        id: `step_${parsed.step_index ?? index}`,
        role: "assistant",
        content: parsed.content || "",
        reasoning: parsed.thinking,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        timestamp: ts,
      };
    }

    if (parsed.type === "GENERIC" || parsed.source === "MODEL") {
      return {
        id: `step_${parsed.step_index ?? index}`,
        role: "tool",
        content: parsed.content || "",
        timestamp: ts,
      };
    }
  } catch {
    // Malformed JSON
  }
  return null;
}

/**
 * Retrieves a paginated slice of chat messages from a session transcript.
 * MEMORY SAFE: Only parses JSON for lines within the requested window, avoiding choking the daemon.
 */
export async function getBrainMessages(
  sessionId: string,
  options?: CliPaginationOptions
): Promise<CliPaginatedResult<CliMessage>> {
  const brainDir = getBrainDir();
  const transcriptPath = path.join(brainDir, sessionId, ".system_generated", "logs", "transcript.jsonl");

  const limit = Math.max(1, options?.limit ?? 50);
  const offset = Math.max(0, options?.offset ?? 0);
  const order = options?.order ?? "asc"; // "asc" (chronological) or "desc" (most recent first)

  if (!fs.existsSync(transcriptPath)) {
    return { items: [], total: 0, hasMore: false, limit, offset };
  }

  // Pass 1: Quick line scan to count valid messages without storing everything in RAM
  const lines: string[] = [];
  const fileStream = fs.createReadStream(transcriptPath, { encoding: "utf8" });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const rawLine of rl) {
    const trimmed = rawLine.trim();
    if (trimmed) {
      lines.push(trimmed);
    }
  }

  const total = lines.length;
  let selectedLines: { line: string; index: number }[] = [];

  if (order === "desc") {
    // Most recent messages first: offset 0 means the latest `limit` messages
    const start = Math.max(0, total - offset - limit);
    const end = Math.max(0, total - offset);
    selectedLines = lines
      .slice(start, end)
      .map((line, i) => ({ line, index: start + i }))
      .reverse();
  } else {
    // Chronological order (from beginning):
    const start = Math.min(total, offset);
    const end = Math.min(total, offset + limit);
    selectedLines = lines.slice(start, end).map((line, i) => ({ line, index: start + i }));
  }

  // Parse ONLY the selected slice into CliMessages
  const items: CliMessage[] = [];
  for (const { line, index } of selectedLines) {
    const msg = parseTranscriptLineToMessage(line, index);
    if (msg) {
      items.push(msg);
    }
  }

  const hasMore = offset + limit < total;

  return {
    items,
    total,
    hasMore,
    limit,
    offset,
  };
}

/**
 * Retrieves session detail with paginated recent messages and companion artifacts.
 */
export async function getBrainSession(
  sessionId: string,
  options?: CliGetSessionOptions
): Promise<CliSessionDetail | null> {
  const brainDir = getBrainDir();
  const sessionDir = path.join(brainDir, sessionId);
  const transcriptPath = path.join(sessionDir, ".system_generated", "logs", "transcript.jsonl");

  if (!fs.existsSync(transcriptPath)) {
    return null;
  }

  const stats = fs.statSync(transcriptPath);
  const summary = await extractSessionSummary(sessionId, sessionDir, transcriptPath, stats);
  if (!summary) return null;

  // Fetch paginated messages (default 50 messages)
  const pagedMessages = await getBrainMessages(sessionId, {
    limit: options?.limit ?? 50,
    offset: options?.offset ?? 0,
    order: options?.order ?? "asc",
  });

  // Collect artifacts unless explicitly disabled
  let artifacts: CliArtifact[] | undefined;
  if (options?.includeArtifacts !== false) {
    artifacts = await collectBrainArtifacts(sessionDir);
  }

  return {
    ...summary,
    messages: pagedMessages.items,
    totalMessages: pagedMessages.total,
    hasMoreMessages: pagedMessages.hasMore,
    artifacts,
  };
}

async function collectBrainArtifacts(sessionDir: string): Promise<CliArtifact[]> {
  const artifacts: CliArtifact[] = [];
  const excluded = new Set([".system_generated", ".tempmediaStorage", ".user_uploaded", "scratch"]);

  try {
    const dirEntries = fs.readdirSync(sessionDir, { withFileTypes: true });
    for (const ent of dirEntries) {
      if (ent.isDirectory()) continue;
      if (excluded.has(ent.name) || ent.name.endsWith(".metadata.json")) continue;

      const artifactPath = path.join(sessionDir, ent.name);
      const metaPath = path.join(sessionDir, `${ent.name}.metadata.json`);
      let summary: string | undefined;
      let title: string = ent.name;

      if (fs.existsSync(metaPath)) {
        try {
          const metaRaw = fs.readFileSync(metaPath, "utf8");
          const meta = JSON.parse(metaRaw);
          if (meta.summary) summary = meta.summary;
        } catch {
          // ignore
        }
      }

      artifacts.push({
        id: ent.name,
        path: artifactPath,
        title,
        summary,
        language: path.extname(ent.name).replace(/^\./, ""),
      });
    }
  } catch {
    // Return whatever was read
  }

  return artifacts;
}
