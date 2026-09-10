import { getAccessToken } from "@/lib/http"
import {
  AGENT_WS_EVENT_NAMES,
  parseBackendWsMessage,
  toAgentChannel,
  type AgentOutgoingEvent,
  type AgentWsEventPayload,
  type SandboxWsPayload,
  type WsIncomingEvent,
  type WsOutgoingEvent,
  type WorkspaceWsEvent,
} from "@/types/agent-ws-events"

type MessageHandler = (data: unknown) => void

type QueryPremitive = string | number | boolean | null | undefined

type QueryParameters<T extends string> = Partial<Record<T, QueryPremitive>>

type WorkspaceKeys = "workspace_id" | "session_id" | "page"

const WORKSPACE_EVENTS = new Set<WorkspaceWsEvent>([
  "workspace:info",
  "workspace:update",
])

export function syncWsAuthCookie() {
  const token = getAccessToken()
  if (!token) return
  document.cookie = `ca_access_token=${encodeURIComponent(token)}; path=/; SameSite=Lax`
}

function normalizeIncomingMessage(
  raw: unknown
): { type: string; data: unknown } | null {
  if (!raw || typeof raw !== "object") return null
  const message = raw as Record<string, unknown>
  const type = message.type

  if (typeof type !== "string") return null

  if (
    WORKSPACE_EVENTS.has(type as WorkspaceWsEvent) ||
    type.startsWith("sandbox:")
  ) {
    return { type, data: message.data ?? message }
  }

  const agentMessage = parseBackendWsMessage(message)
  if (agentMessage) {
    return { type: agentMessage.channel, data: agentMessage.payload }
  }

  return null
}

class WebSocketManager {
  private socket: WebSocket | null = null
  private url: string = ""
  private handlers = new Map<string, Set<MessageHandler>>()
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(url: string) {
    this.url = url
  }

  connect(): Promise<void> {
    syncWsAuthCookie()

    return new Promise((resolve, reject) => {
      if (
        this.socket &&
        (this.socket.readyState === WebSocket.OPEN ||
          this.socket.readyState === WebSocket.CONNECTING)
      ) {
        resolve()
        return
      }

      this.socket = new WebSocket(this.url)

      this.socket.onopen = () => {
        this.reconnectAttempts = 0
        resolve()
      }

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          const normalized = normalizeIncomingMessage(message)
          if (!normalized) return

          const handlers = this.handlers.get(normalized.type)
          handlers?.forEach((handle) => handle(normalized.data))

          if (normalized.type.startsWith("sandbox:")) {
            const wildcardHandlers = this.handlers.get("sandbox:*")
            wildcardHandlers?.forEach((handle) =>
              handle({ type: normalized.type, data: normalized.data })
            )
          }
        } catch (error) {
          console.error("Invalid websocket message:", error)
        }
      }

      this.socket.onclose = () => {
        this.socket = null
        this.reconnect()
      }

      this.socket.onerror = reject
    })
  }

  private reconnect() {
    if (this.reconnectTimer) return
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 10000)
    this.reconnectAttempts += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.connect()
    }, delay)
  }

  subscribe(type: WsIncomingEvent | string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }

    this.handlers.get(type)!.add(handler)
    return () => {
      this.handlers.get(type)?.delete(handler)
    }
  }

  subscribeAgentEvents(handler: (payload: AgentWsEventPayload) => void) {
    const unsubs = AGENT_WS_EVENT_NAMES.map((name) =>
      this.subscribe(toAgentChannel(name), (data) => {
        handler(data as AgentWsEventPayload)
      })
    )
    return () => {
      unsubs.forEach((unsub) => unsub())
    }
  }

  subscribeSandboxEvents(
    handler: (event: { type: string; data: SandboxWsPayload }) => void
  ) {
    return this.subscribe("sandbox:*", (raw) => {
      handler(raw as { type: string; data: SandboxWsPayload })
    })
  }

  send(type: WsOutgoingEvent, data: unknown) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected")
    }
    this.socket.send(JSON.stringify({ type, data }))
  }

  sendAgentQuery(
    query: string,
    sessionId?: string | null,
    options?: { model?: string; reasoning_effort?: string }
  ) {
    const payload: AgentOutgoingEvent = "agent:send"
    this.send(payload, {
      query,
      session_id: sessionId ?? undefined,
      ...(options?.model ? { model: options.model } : {}),
      ...(options?.reasoning_effort
        ? { reasoning_effort: options.reasoning_effort }
        : {}),
    })
  }

  sendAgentStart(data: Record<string, unknown>) {
    this.send("agent:start", data)
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.socket?.close()
    this.socket = null
    this.reconnectAttempts = 0
  }
}

let ws: WebSocketManager | null = null
let wsKey: string | null = null

export function get_wehsocket(
  queryParameters: QueryParameters<WorkspaceKeys>
): WebSocketManager {
  const key = JSON.stringify(queryParameters)

  if (ws && wsKey === key) {
    return ws
  }

  ws?.disconnect()

  const searchParams = new URLSearchParams()

  Object.entries(queryParameters).forEach(([key, value]) => {
    if (value != null) {
      searchParams.set(key, String(value))
    }
  })

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  const url = `${protocol}//${window.location.host}/ws?${searchParams.toString()}`

  ws = new WebSocketManager(url)
  wsKey = key
  return ws
}

export function reset_websocket() {
  ws?.disconnect()
  ws = null
  wsKey = null
}
