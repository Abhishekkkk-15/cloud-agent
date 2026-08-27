import type { AgentEvent, AgentEventType } from "@/types/chat-ui"

/**
 * pi_sdk `EventType` values (uppercase). Mirrors the SDK event table.
 * WS wire names are the lowercase snake form in `AGENT_WS_EVENT_NAMES`.
 */
export const PI_SDK_EVENT_TYPES = [
  "RUN_STARTED",
  "USER_MESSAGE",
  "THINKING_DELTA",
  "THINKING",
  "TEXT_DELTA",
  "TEXT",
  "TOOL_CALL",
  "TOOL_RESULT",
  "PERMISSION_REQUEST",
  "COMPACTION",
  "USAGE",
  "ERROR",
  "STATUS",
  "RUN_COMPLETED",
  "RUN_FAILED",
] as const

export type PiSdkEventType = (typeof PI_SDK_EVENT_TYPES)[number]

/** Useful `event.data` keys per pi_sdk event type. */
export const PI_SDK_EVENT_DATA_KEYS: Record<
  PiSdkEventType,
  readonly string[]
> = {
  RUN_STARTED: ["prompt", "session_id"],
  USER_MESSAGE: ["text"],
  THINKING_DELTA: ["text"],
  THINKING: ["text"],
  TEXT_DELTA: ["text"],
  TEXT: ["text"],
  TOOL_CALL: ["name", "arguments", "id"],
  TOOL_RESULT: ["name", "content", "id"],
  PERMISSION_REQUEST: ["tool", "target", "details"],
  COMPACTION: ["message"],
  USAGE: [
    "prompt_tokens",
    "completion_tokens",
    "total_tokens",
    "estimated_cost_usd",
  ],
  ERROR: ["error"],
  STATUS: ["message"],
  RUN_COMPLETED: ["text", "session_id"],
  RUN_FAILED: ["error", "session_id"],
}

/** Flat JSON the API sends over WS (`WsEvent.to_dict()`). Not pi_sdk's internal shape. */
export type BackendWsWireMessage = {
  /** `run_started` or `agent:{event_name}` (see `event_handler.py`). */
  type: `agent:${AgentWsEventName}` | AgentWsEventName | (string & {})
  text?: string
  session_id?: string
  tool?: string
  tool_call_id?: string
  arguments?: unknown
  content?: string
  target?: string
  details?: string
  denied?: boolean
  error?: string
  message?: string
  usage?: AgentWsUsage
  done?: boolean
}

/** Wire names from `event_handler` → `agent:{name}` subscription channels. */
export const AGENT_WS_EVENT_NAMES = [
  "run_started",
  "user_message",
  "thinking_delta",
  "thinking",
  "text_delta",
  "text",
  "tool_call",
  "tool_result",
  "permission_request",
  "compaction",
  "usage",
  "error",
  "status",
  "run_completed",
  "run_failed",
] as const

export type AgentWsEventName = (typeof AGENT_WS_EVENT_NAMES)[number]

export type AgentWsChannel = `agent:${AgentWsEventName}`

export type AgentWsUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  estimated_cost_usd?: number
}

/** Flat payload from backend `WsEvent.to_dict()`. */
export type AgentWsEventPayload = {
  type: AgentWsEventName
  /** pi_sdk shortcut: same as `data.text` or `data.content` when present. */
  text?: string
  session_id?: string
  tool?: string
  tool_call_id?: string
  arguments?: unknown
  content?: string
  target?: string
  details?: string
  denied?: boolean
  error?: string
  message?: string
  usage?: AgentWsUsage
  done?: boolean
}

export type WorkspaceWsEvent = "workspace:info" | "workspace:update"
export type SandboxWsEvent = "sandbox:start"
export type AgentOutgoingEvent = "agent:send" | "agent:start"

export type WsOutgoingEvent = AgentOutgoingEvent
export type WsIncomingEvent =
  | WorkspaceWsEvent
  | SandboxWsEvent
  | AgentWsChannel

const AGENT_WS_EVENT_NAME_SET = new Set<string>(AGENT_WS_EVENT_NAMES)

const PI_SDK_TO_WS_NAME: Record<PiSdkEventType, AgentWsEventName> = {
  RUN_STARTED: "run_started",
  USER_MESSAGE: "user_message",
  THINKING_DELTA: "thinking_delta",
  THINKING: "thinking",
  TEXT_DELTA: "text_delta",
  TEXT: "text",
  TOOL_CALL: "tool_call",
  TOOL_RESULT: "tool_result",
  PERMISSION_REQUEST: "permission_request",
  COMPACTION: "compaction",
  USAGE: "usage",
  ERROR: "error",
  STATUS: "status",
  RUN_COMPLETED: "run_completed",
  RUN_FAILED: "run_failed",
}

const WS_TO_UI_EVENT_TYPE: Record<AgentWsEventName, AgentEventType> = {
  run_started: "RUN_STARTED",
  user_message: "USER_MESSAGE",
  thinking_delta: "THINKING_DELTA",
  thinking: "THINKING",
  text_delta: "TEXT_DELTA",
  text: "TEXT",
  tool_call: "TOOL_CALL",
  tool_result: "TOOL_RESULT",
  permission_request: "PERMISSION_REQUEST",
  compaction: "COMPACTION",
  usage: "USAGE",
  error: "ERROR",
  status: "STATUS",
  run_completed: "RUN_COMPLETED",
  run_failed: "RUN_FAILED",
}

export function toAgentChannel(name: AgentWsEventName): AgentWsChannel {
  return `agent:${name}`
}

export function isAgentWsEventName(value: string): value is AgentWsEventName {
  return AGENT_WS_EVENT_NAME_SET.has(value)
}

/** pi_sdk: `event.text` ≈ `data.text` | `data.content` */
export function wsPayloadText(payload: AgentWsEventPayload): string | undefined {
  if (payload.text) return payload.text
  if (payload.content) return payload.content
  if (payload.error) return payload.error
  if (payload.message) return payload.message
  return undefined
}

function normalizeWsEventName(rawType: string): AgentWsEventName | null {
  const stripped = rawType.startsWith("agent:")
    ? rawType.slice("agent:".length)
    : rawType

  if (isAgentWsEventName(stripped)) return stripped

  const upper = stripped.toUpperCase() as PiSdkEventType
  if (upper in PI_SDK_TO_WS_NAME) {
    return PI_SDK_TO_WS_NAME[upper]
  }

  return null
}

export function parseBackendWsMessage(
  raw: unknown
): { channel: AgentWsChannel; payload: AgentWsEventPayload } | null {
  const payload = parseAgentWsPayload(raw)
  if (!payload) return null
  return { channel: toAgentChannel(payload.type), payload }
}

export function parseAgentWsPayload(
  value: unknown
): AgentWsEventPayload | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const rawType = record.type
  if (typeof rawType !== "string") return null

  const name = normalizeWsEventName(rawType)
  if (!name) return null

  return {
    type: name,
    text: typeof record.text === "string" ? record.text : undefined,
    session_id:
      typeof record.session_id === "string" ? record.session_id : undefined,
    tool: typeof record.tool === "string" ? record.tool : undefined,
    tool_call_id:
      typeof record.tool_call_id === "string"
        ? record.tool_call_id
        : undefined,
    arguments: record.arguments,
    content: typeof record.content === "string" ? record.content : undefined,
    target: typeof record.target === "string" ? record.target : undefined,
    details: typeof record.details === "string" ? record.details : undefined,
    denied: record.denied === true,
    error: typeof record.error === "string" ? record.error : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
    usage:
      record.usage && typeof record.usage === "object"
        ? (record.usage as AgentWsUsage)
        : undefined,
    done: record.done === true,
  }
}

/** Map WS payload → UI `AgentEvent` using pi_sdk data key names in `data`. */
export function wsEventToUiEvent(
  payload: AgentWsEventPayload,
  id = crypto.randomUUID()
): AgentEvent {
  const data: Record<string, unknown> = {}
  const text = wsPayloadText(payload)

  if (text) data.text = text
  if (payload.session_id) data.session_id = payload.session_id

  if (payload.type === "run_started" && text) {
    data.prompt = text
  }

  if (payload.tool) data.name = payload.tool
  if (payload.tool_call_id) data.id = payload.tool_call_id
  if (payload.arguments !== undefined) data.arguments = payload.arguments
  if (payload.content) data.content = payload.content
  if (payload.target) data.target = payload.target
  if (payload.details) data.details = payload.details
  if (payload.denied) data.denied = payload.denied
  if (payload.error) data.error = payload.error
  if (payload.message) data.message = payload.message
  if (payload.usage) {
    data.prompt_tokens = payload.usage.prompt_tokens
    data.completion_tokens = payload.usage.completion_tokens
    data.total_tokens = payload.usage.total_tokens
    data.estimated_cost_usd = payload.usage.estimated_cost_usd
  }
  if (payload.done) data.done = payload.done

  return {
    id,
    type: WS_TO_UI_EVENT_TYPE[payload.type],
    data,
  }
}

export function isTerminalAgentEvent(payload: AgentWsEventPayload) {
  return payload.type === "run_completed" || payload.type === "run_failed"
}

export function piSdkTypeFromWsName(name: AgentWsEventName): PiSdkEventType {
  return WS_TO_UI_EVENT_TYPE[name]
}
