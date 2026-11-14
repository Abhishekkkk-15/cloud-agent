import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  type ICliAdapter,
  BaseCliAdapter,
  type CliAvailability,
  type CliSessionSummary,
  type CliSessionDetail,
  type CliMessage,
  type CliRunOptions,
  type CliEvent,
  type CliPaginatedResult,
  type CliSessionListOptions,
  type CliGetSessionOptions,
  type CliPaginationOptions,
  type CliCapabilities,
  type CliModelCapability,
  type CliWorkerInfo,
} from "@cloud-agent/cli-interface";
import { getAgyBinaryPath } from "./paths.js";
import {
  listBrainSessions,
  getBrainSession,
  getBrainMessages,
  renameBrainSession,
  pinBrainSession,
  deleteBrainSession,
} from "./transcript-reader.js";
import { AntigravityStreamClient } from "./stream-client.js";

const execFileAsync = promisify(execFile);

const ANTIGRAVITY_FALLBACK_MODELS: CliModelCapability[] = [
  {
    id: "gemini-3.8-flash-high",
    name: "Gemini 3.8 Flash (High)",
    description: "Default: high speed, deep coding comprehension with deep thinking tokens",
    provider: "Google",
    supportsEffort: true,
    supportedEffortLevels: ["low", "medium", "high", "xhigh", "max"],
    isDefault: true,
  },
  {
    id: "gemini-3.8-flash-medium",
    name: "Gemini 3.8 Flash (Medium)",
    description: "Balanced reasoning for fast edits and standard agent turns",
    provider: "Google",
    supportsEffort: true,
    supportedEffortLevels: ["low", "medium", "high", "xhigh", "max"],
  },
  {
    id: "gemini-3.8-flash-low",
    name: "Gemini 3.8 Flash (Low)",
    description: "Lowest latency and token consumption for quick queries",
    provider: "Google",
    supportsEffort: true,
    supportedEffortLevels: ["low", "medium", "high", "xhigh", "max"],
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6 (Thinking)",
    description: "Extended chain-of-thought and architectural planning",
    provider: "Anthropic",
    supportsEffort: true,
    supportedEffortLevels: ["low", "medium", "high", "max"],
  },
  {
    id: "claude-opus-4-6-thinking",
    name: "Claude Opus 4.6 (Thinking)",
    description: "Maximum depth reasoning for complex refactoring",
    provider: "Anthropic",
    supportsEffort: true,
    supportedEffortLevels: ["low", "medium", "high", "max"],
  },
  {
    id: "gpt-oss-120b-medium",
    name: "GPT-OSS 120B (Medium)",
    description: "Open weights model running locally or hybrid",
    provider: "OSS",
    supportsEffort: false,
  },
];

/**
 * Adapter for Google Antigravity CLI (agy).
 * Reads sessions directly from ~/.gemini/antigravity-cli/brain zero-DB
 * and streams execution via `agy --input-format stream-json --output-format stream-json`.
 */
export class AntigravityAdapter extends BaseCliAdapter implements ICliAdapter {
  readonly id = "antigravity";
  readonly displayName = "Google Antigravity";
  readonly binaryName = "agy";

  private client = new AntigravityStreamClient();

  /**
   * Verifies if `agy` is installed and executable.
   */
  async checkAvailability(): Promise<CliAvailability> {
    const binPath = getAgyBinaryPath();
    if (!binPath) {
      return {
        available: false,
        error: "Antigravity CLI (agy) binary not found in PATH or standard directories.",
      };
    }

    try {
      const { stdout } = await execFileAsync(binPath, ["--version"]);
      return {
        available: true,
        version: stdout.trim(),
        binaryPath: binPath,
      };
    } catch (err) {
      return {
        available: false,
        binaryPath: binPath,
        error: `Failed to execute ${binPath}: ${String(err)}`,
      };
    }
  }

  /**
   * Discovers and lists Antigravity sessions from disk with pagination.
   */
  async listSessions(
    options?: CliSessionListOptions | string
  ): Promise<CliPaginatedResult<CliSessionSummary>> {
    return listBrainSessions(options);
  }

  /**
   * Retrieves session summary and a paginated window of messages.
   */
  async getSession(
    sessionId: string,
    options?: CliGetSessionOptions
  ): Promise<CliSessionDetail | null> {
    return getBrainSession(sessionId, options);
  }

  /**
   * Retrieves a paginated slice of chat messages for infinite scrolling.
   */
  async getMessages(
    sessionId: string,
    options?: CliPaginationOptions
  ): Promise<CliPaginatedResult<CliMessage>> {
    return getBrainMessages(sessionId, options);
  }

  /**
   * Streams execution events for a prompt.
   */
  async *run(options: CliRunOptions): AsyncIterable<CliEvent> {
    yield* this.client.run(options);
  }

  /**
   * Cancels a running turn.
   */
  async cancel(sessionId: string): Promise<void> {
    this.client.cancel(sessionId);
  }

  isTurnRunning(sessionId: string): boolean {
    return this.client.isTurnRunning(sessionId);
  }

  /**
   * Renames a brain session by updating its meta.json on disk.
   */
  async renameSession(sessionId: string, title: string): Promise<void> {
    return renameBrainSession(sessionId, title);
  }

  /**
   * Pins or unpins a brain session in meta.json.
   */
  async pinSession(sessionId: string, pinned: boolean): Promise<void> {
    return pinBrainSession(sessionId, pinned);
  }

  /**
   * Deletes a brain session from disk.
   */
  async deleteSession(sessionId: string): Promise<void> {
    return deleteBrainSession(sessionId);
  }

  /**
   * Responds to an interactive permission request.
   */
  async respondPermission(sessionId: string, requestId: string, allow: boolean): Promise<void> {
    console.log(`[AntigravityAdapter] respondPermission: sessionId=${sessionId}, requestId=${requestId}, allow=${allow}`);
    const delivered = this.client.respondPermission(sessionId, requestId, allow);
    if (!delivered) {
      console.warn(`[AntigravityAdapter] No active worker found for session ${sessionId} to respond permission`);
    }
  }

  /**
   * Lists active warm persistent CLI worker child processes.
   */
  async listWorkers(): Promise<CliWorkerInfo[]> {
    return this.client.listWorkers();
  }

  /**
   * Terminates a persistent CLI worker child process by session ID.
   */
  async killWorker(sessionId: string): Promise<boolean> {
    return this.client.killWorker(sessionId);
  }

  /**
   * Restarts a persistent CLI worker child process by session ID.
   */
  async restartWorker(sessionId: string): Promise<boolean> {
    return this.client.restartWorker(sessionId);
  }

  /**
   * Terminates all currently idle persistent CLI workers.
   */
  async killAllIdleWorkers(): Promise<number> {
    return this.client.killAllIdleWorkers();
  }

  /**
   * Returns Antigravity capability manifest.
   */
  async getCapabilities(): Promise<CliCapabilities> {
    return {
      cliId: this.id,
      displayName: this.displayName,
      supportedModes: ["auto", "plan", "accept-edits"],
      defaultMode: "auto",
      supportsEffort: true,
      supportedEffortLevels: ["low", "medium", "high", "xhigh", "max"],
      defaultEffort: "high",
      allowFileUpload: true,
      permissions: {
        supportsHeadlessHitl: false,
        requiresBypassInHeadless: true,
        bypassFlagName: "--dangerously-skip-permissions",
        warningMessage:
          "Google Antigravity runs headlessly in daemon mode without a TTY terminal device. Auto-approving permissions is required to prevent the background agent worker from freezing on unhandled interactive confirmation prompts.",
        defaultAutoApprove: true,
      },
      models: {
        supportsDynamicDiscovery: true,
        fallbackModels: ANTIGRAVITY_FALLBACK_MODELS,
      },
    };
  }

  /**
   * Dynamically lists available models via `agy models` on the host machine.
   */
  async listModels(): Promise<CliModelCapability[]> {
    const binPath = getAgyBinaryPath();
    if (!binPath) return ANTIGRAVITY_FALLBACK_MODELS;

    try {
      const { stdout } = await execFileAsync(binPath, ["models"], {
        timeout: 10000,
      });

      const lines = stdout
        .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
        .replace(/Fetching available models\.\.\./g, "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      const parsedModels: CliModelCapability[] = [];

      for (const line of lines) {
        // Line format from `agy models`: "<model-id>\t<Model Display Name>" or "<model-id>  <name>"
        const parts = line.split(/\t+|\s{2,}/);
        const id = parts[0]?.trim();
        if (!id || id.startsWith("/") || id.startsWith("#")) continue;

        const name = parts[1]?.trim() || id;
        const lowerId = id.toLowerCase();

        let provider = "Google";
        if (lowerId.includes("claude") || lowerId.includes("sonnet") || lowerId.includes("opus")) {
          provider = "Anthropic";
        } else if (lowerId.includes("gpt") || lowerId.includes("oss")) {
          provider = "OSS";
        }

        const supportsEffort =
          lowerId.includes("flash") ||
          lowerId.includes("thinking") ||
          lowerId.includes("sonnet") ||
          lowerId.includes("opus");

        parsedModels.push({
          id,
          name,
          provider,
          supportsEffort,
          supportedEffortLevels: supportsEffort
            ? ["low", "medium", "high", "xhigh", "max"]
            : undefined,
          isDefault: lowerId === "gemini-3.8-flash-high",
        });
      }

      return parsedModels.length > 0 ? parsedModels : ANTIGRAVITY_FALLBACK_MODELS;
    } catch {
      return ANTIGRAVITY_FALLBACK_MODELS;
    }
  }
}
