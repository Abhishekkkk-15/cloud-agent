import fs from "node:fs";
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
import { getCodexBinaryPath, getCodexModelsCacheFile } from "./paths.js";
import {
  listCodexSessions,
  getCodexSession,
  getCodexMessages,
  renameCodexSession,
  pinCodexSession,
  deleteCodexSession,
} from "./transcript-reader.js";
import { CodexStreamClient } from "./stream-client.js";

const execFileAsync = promisify(execFile);

const CODEX_FALLBACK_MODELS: CliModelCapability[] = [
  {
    id: "gpt-5.6-luna",
    name: "GPT-5.6-Luna",
    description: "Default: Flagship agentic coding and deep reasoning model",
    provider: "OpenAI",
    supportsEffort: true,
    supportedEffortLevels: ["low", "medium", "high", "xhigh", "max"],
    defaultEffort: "medium",
    supportsSearch: true,
    contextWindow: 272000,
    maxContextWindow: 872000,
    inputModalities: ["text", "image"],
    isDefault: true,
  },
  {
    id: "gpt-6-luna",
    name: "GPT-6-Luna",
    description: "Next-generation deep architectural reasoning agent",
    provider: "OpenAI",
    supportsEffort: true,
    supportedEffortLevels: ["low", "medium", "high", "xhigh", "max"],
    defaultEffort: "medium",
    supportsSearch: true,
    contextWindow: 272000,
    maxContextWindow: 872000,
    inputModalities: ["text", "image"],
  },
  {
    id: "gpt-5.6-terra",
    name: "GPT-5.6-Terra",
    description: "High-throughput deep coding model supporting ultra reasoning depth",
    provider: "OpenAI",
    supportsEffort: true,
    supportedEffortLevels: ["low", "medium", "high", "xhigh", "max", "ultra"],
    defaultEffort: "medium",
    supportsSearch: true,
    contextWindow: 272000,
    maxContextWindow: 872000,
    inputModalities: ["text", "image"],
  },
  {
    id: "gpt-reserve",
    name: "GPT-Reserve",
    description: "Fast reserve model for high-traffic and low-latency agent tasks",
    provider: "OpenAI",
    supportsEffort: true,
    supportedEffortLevels: ["low", "medium", "high", "xhigh", "max"],
    defaultEffort: "medium",
    supportsSearch: true,
    contextWindow: 272000,
    maxContextWindow: 872000,
    inputModalities: ["text", "image"],
  },
];

/**
 * Adapter for OpenAI Codex CLI (codex-cli).
 * Reads sessions directly from ~/.codex zero-DB
 * and streams execution via `codex exec [resume] --json`.
 */
export class CodexAdapter extends BaseCliAdapter implements ICliAdapter {
  readonly id = "codex";
  readonly displayName = "OpenAI Codex";
  readonly binaryName = "codex";

  private client = new CodexStreamClient();

  /**
   * Verifies if `codex` is installed and executable on the host system.
   */
  async checkAvailability(): Promise<CliAvailability> {
    const binPath = getCodexBinaryPath();
    if (!binPath) {
      return {
        available: false,
        error: "Codex CLI (codex) executable not found in PATH or standard directories.",
      };
    }

    try {
      let stdout: string;
      if (process.platform === "win32" && binPath.endsWith(".cmd")) {
        const res = await execFileAsync("cmd.exe", ["/d", "/s", "/c", binPath, "--version"]);
        stdout = res.stdout;
      } else {
        const res = await execFileAsync(binPath, ["--version"]);
        stdout = res.stdout;
      }
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
   * Discovers and lists Codex sessions from ~/.codex/session_index.jsonl.
   */
  async listSessions(
    options?: CliSessionListOptions | string
  ): Promise<CliPaginatedResult<CliSessionSummary>> {
    return listCodexSessions(options);
  }

  /**
   * Retrieves session summary and paginated messages from rollout.
   */
  async getSession(
    sessionId: string,
    options?: CliGetSessionOptions
  ): Promise<CliSessionDetail | null> {
    return getCodexSession(sessionId, options);
  }

  /**
   * Retrieves a paginated slice of chat messages for infinite scrolling.
   */
  async getMessages(
    sessionId: string,
    options?: CliPaginationOptions
  ): Promise<CliPaginatedResult<CliMessage>> {
    return getCodexMessages(sessionId, options);
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

  async renameSession(sessionId: string, title: string): Promise<void> {
    return renameCodexSession(sessionId, title);
  }

  async pinSession(sessionId: string, pinned: boolean): Promise<void> {
    return pinCodexSession(sessionId, pinned);
  }

  async deleteSession(sessionId: string): Promise<void> {
    return deleteCodexSession(sessionId);
  }

  async listWorkers(): Promise<CliWorkerInfo[]> {
    return this.client.listWorkers();
  }

  async killWorker(sessionId: string): Promise<boolean> {
    return this.client.killWorker(sessionId);
  }

  async restartWorker(sessionId: string): Promise<boolean> {
    return this.client.restartWorker(sessionId);
  }

  async killAllIdleWorkers(): Promise<number> {
    return this.client.killAllIdleWorkers();
  }

  /**
   * Declares Codex capability manifest.
   */
  async getCapabilities(): Promise<CliCapabilities> {
    const models = await this.listModels();
    return {
      cliId: this.id,
      displayName: this.displayName,
      supportedModes: ["auto", "plan", "accept-edits"],
      defaultMode: "auto",
      supportsEffort: true,
      supportedEffortLevels: ["low", "medium", "high", "xhigh", "max", "ultra"],
      defaultEffort: "medium",
      allowFileUpload: true,
      supportsWebSearch: true,
      supportsWorktree: true,
      supportsSandboxPolicies: true,
      supportedSandboxPolicies: ["read-only", "workspace-write", "danger-full-access"],
      permissions: {
        supportsHeadlessHitl: false,
        requiresBypassInHeadless: true,
        bypassFlagName: "--dangerously-bypass-approvals-and-sandbox",
        warningMessage:
          "OpenAI Codex runs headlessly in daemon mode without a TTY terminal. Permission bypass is required to prevent child processes from freezing on unhandled interactive prompts.",
        defaultAutoApprove: true,
      },
      models: {
        supportsDynamicDiscovery: true,
        fallbackModels: models.length > 0 ? models : CODEX_FALLBACK_MODELS,
      },
    };
  }

  /**
   * Dynamically lists available models from ~/.codex/models_cache.json.
   */
  async listModels(): Promise<CliModelCapability[]> {
    const cacheFile = getCodexModelsCacheFile();
    if (!fs.existsSync(cacheFile)) {
      return CODEX_FALLBACK_MODELS;
    }

    try {
      const raw = fs.readFileSync(cacheFile, "utf8");
      const data = JSON.parse(raw);
      if (!Array.isArray(data.models)) {
        return CODEX_FALLBACK_MODELS;
      }

      const results: CliModelCapability[] = [];
      for (const m of data.models) {
        // Only show models intended for listing (or reserve)
        if (m.visibility === "hide" && m.slug !== "gpt-reserve") continue;

        const supportedEfforts = Array.isArray(m.supported_reasoning_levels)
          ? m.supported_reasoning_levels.map((r: { effort: string }) => r.effort)
          : undefined;

        const effortDescriptions: Record<string, string> = {};
        if (Array.isArray(m.supported_reasoning_levels)) {
          for (const r of m.supported_reasoning_levels) {
            if (r.effort && r.description) {
              effortDescriptions[r.effort] = r.description;
            }
          }
        }

        results.push({
          id: m.slug,
          name: m.display_name || m.slug,
          description: m.description,
          provider: "OpenAI",
          supportsEffort: Array.isArray(supportedEfforts) && supportedEfforts.length > 0,
          supportedEffortLevels: supportedEfforts,
          defaultEffort: m.default_reasoning_level || "medium",
          reasoningEffortDescriptions: Object.keys(effortDescriptions).length > 0 ? effortDescriptions : undefined,
          supportsSearch: Boolean(m.supports_search_tool || m.web_search_tool_type),
          contextWindow: typeof m.context_window === "number" ? m.context_window : undefined,
          maxContextWindow: typeof m.max_context_window === "number" ? m.max_context_window : undefined,
          inputModalities: Array.isArray(m.input_modalities) ? m.input_modalities : ["text", "image"],
          isDefault: m.slug === "gpt-5.6-luna",
        });
      }

      return results.length > 0 ? results : CODEX_FALLBACK_MODELS;
    } catch {
      return CODEX_FALLBACK_MODELS;
    }
  }
}
