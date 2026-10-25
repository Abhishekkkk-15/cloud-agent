import type {
  CliAvailability,
  CliSessionSummary,
  CliSessionDetail,
  CliMessage,
  CliRunOptions,
  CliPtyOptions,
  CliPtyProcess,
  CliPaginatedResult,
  CliSessionListOptions,
  CliGetSessionOptions,
  CliPaginationOptions,
} from "./types.js";
import type { CliEvent } from "./events.js";

/**
 * Common unified interface for all CLI coding agent adapters.
 * Every CLI adapter package under `packages/cli/*` must implement this interface.
 */
export interface ICliAdapter {
  /** Unique identifier of the CLI tool, e.g. "antigravity", "codex", "claude" */
  readonly id: string;

  /** Human-readable display name, e.g. "Google Antigravity" */
  readonly displayName: string;

  /** Name or path of the primary CLI executable, e.g. "agy" */
  readonly binaryName: string;

  /** Checks if the CLI is installed, authenticated, and ready on this host */
  checkAvailability(): Promise<CliAvailability>;

  /**
   * Discovers and lists sessions directly from the CLI's local disk storage.
   * Supports pagination and workspace filtering.
   */
  listSessions(
    options?: CliSessionListOptions | string
  ): Promise<CliPaginatedResult<CliSessionSummary>>;

  /**
   * Retrieves session metadata and paginated recent messages.
   * Prevents daemon choking by streaming/paging large message histories.
   */
  getSession(
    sessionId: string,
    options?: CliGetSessionOptions
  ): Promise<CliSessionDetail | null>;

  /**
   * Retrieves a paginated slice of chat messages for infinite scrolling.
   */
  getMessages(
    sessionId: string,
    options?: CliPaginationOptions
  ): Promise<CliPaginatedResult<CliMessage>>;

  /**
   * Runs an instruction turn or starts a new session, streaming normalized events.
   */
  run(options: CliRunOptions): AsyncIterable<CliEvent>;

  /**
   * Approves or denies a pending permission request.
   */
  respondPermission?(sessionId: string, requestId: string, allow: boolean): Promise<void>;

  /**
   * Renames a session.
   */
  renameSession?(sessionId: string, title: string): Promise<void>;

  /**
   * Deletes a session and its transcript from disk.
   */
  deleteSession?(sessionId: string): Promise<void>;

  /**
   * Pins or unpins a session.
   */
  pinSession?(sessionId: string, pinned: boolean): Promise<void>;

  /**
   * Cancels/interrupts an ongoing agent execution.
   */
  cancel(sessionId: string): Promise<void>;

  /**
   * Optional interactive terminal fallback (via pseudo-terminal).
   */
  createPty?(options: CliPtyOptions): Promise<CliPtyProcess>;
}

/**
 * Base abstract class providing standard helper methods and defaults.
 */
export abstract class BaseCliAdapter implements ICliAdapter {
  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly binaryName: string;

  abstract checkAvailability(): Promise<CliAvailability>;
  abstract listSessions(
    options?: CliSessionListOptions | string
  ): Promise<CliPaginatedResult<CliSessionSummary>>;
  abstract getSession(
    sessionId: string,
    options?: CliGetSessionOptions
  ): Promise<CliSessionDetail | null>;
  abstract getMessages(
    sessionId: string,
    options?: CliPaginationOptions
  ): Promise<CliPaginatedResult<CliMessage>>;
  abstract run(options: CliRunOptions): AsyncIterable<CliEvent>;
  abstract cancel(sessionId: string): Promise<void>;

  async respondPermission?(sessionId: string, requestId: string, allow: boolean): Promise<void> {
    throw new Error(`respondPermission is not implemented for ${this.id}`);
  }

  async renameSession?(sessionId: string, title: string): Promise<void> {
    throw new Error(`renameSession is not implemented for ${this.id}`);
  }

  async deleteSession?(sessionId: string): Promise<void> {
    throw new Error(`deleteSession is not implemented for ${this.id}`);
  }

  async pinSession?(sessionId: string, pinned: boolean): Promise<void> {
    throw new Error(`pinSession is not implemented for ${this.id}`);
  }

  async createPty?(options: CliPtyOptions): Promise<CliPtyProcess> {
    throw new Error(`PTY is not supported by adapter ${this.id}`);
  }
}
