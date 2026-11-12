import type { CliEvent } from "@cloud-agent/cli-interface";

export type SessionStreamSubscriber = (chunk: {
  event?: CliEvent;
  done?: boolean;
  result?: any;
}) => void;

interface ActiveTurnState {
  buffer: CliEvent[];
  subscribers: Set<SessionStreamSubscriber>;
  startTime: number;
}

/**
 * In-memory multiplexer for active agent session streams.
 * Allows multiple concurrent clients (or reconnected clients after app close)
 * to receive live streaming chunks, thoughts, and tool execution events in real time.
 * Zero-DB compliant: strictly lives in memory during process runtime.
 */
export class SessionStreamHub {
  private activeTurns = new Map<string, ActiveTurnState>();

  /**
   * Initializes a new turn buffer and listeners for a session.
   */
  startTurn(sessionId: string): void {
    const existing = this.activeTurns.get(sessionId);
    if (existing) {
      existing.buffer = [];
      existing.startTime = Date.now();
    } else {
      this.activeTurns.set(sessionId, {
        buffer: [],
        subscribers: new Set(),
        startTime: Date.now(),
      });
    }
  }

  /**
   * Broadcasts an event to all subscribers of this session and buffers it.
   */
  broadcast(sessionId: string, event: CliEvent): void {
    let state = this.activeTurns.get(sessionId);
    if (!state) {
      state = {
        buffer: [],
        subscribers: new Set(),
        startTime: Date.now(),
      };
      this.activeTurns.set(sessionId, state);
    }

    // Buffer events for late-joining or reconnecting subscribers (cap at 500)
    state.buffer.push(event);
    if (state.buffer.length > 500) {
      state.buffer.shift();
    }

    // Deliver to all active subscribers
    for (const sub of state.subscribers) {
      try {
        sub({ event });
      } catch (err) {
        console.warn(`[SessionStreamHub] Subscriber delivery error:`, err);
      }
    }
  }

  /**
   * Signals completion to all subscribers and frees listeners.
   */
  endTurn(sessionId: string, result?: any): void {
    const state = this.activeTurns.get(sessionId);
    if (!state) return;

    for (const sub of state.subscribers) {
      try {
        sub({ done: true, result });
      } catch {
        // ignore delivery failure
      }
    }
    state.subscribers.clear();

    // Keep buffer briefly in case a client reconnects right as the turn completes, then clean up
    const cleanupTimer = setTimeout(() => {
      const curr = this.activeTurns.get(sessionId);
      if (curr && curr.subscribers.size === 0) {
        this.activeTurns.delete(sessionId);
      }
    }, 30000);
    if (typeof cleanupTimer.unref === "function") {
      cleanupTimer.unref();
    }
  }

  /**
   * Subscribes a listener to live events for a session.
   * Returns an unsubscribe function.
   */
  subscribe(sessionId: string, subscriber: SessionStreamSubscriber): () => void {
    let state = this.activeTurns.get(sessionId);
    if (!state) {
      state = {
        buffer: [],
        subscribers: new Set(),
        startTime: Date.now(),
      };
      this.activeTurns.set(sessionId, state);
    }

    state.subscribers.add(subscriber);

    return () => {
      state?.subscribers.delete(subscriber);
    };
  }

  /**
   * Retrieves buffered events of the current active turn.
   */
  getBufferedEvents(sessionId: string): CliEvent[] {
    return this.activeTurns.get(sessionId)?.buffer || [];
  }

  /**
   * Checks if a session has an active turn tracked in the hub.
   */
  hasActiveTurn(sessionId: string): boolean {
    return this.activeTurns.has(sessionId);
  }
}

export const sessionStreamHub = new SessionStreamHub();
