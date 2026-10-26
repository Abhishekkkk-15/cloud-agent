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
}
