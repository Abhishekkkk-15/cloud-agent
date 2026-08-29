import type { Message } from "@cloud-agent/shared"

import { summaryFromEvents } from "@/lib/agent-events"
import {
  wsEventToUiEvent,
  type AgentWsEventPayload,
} from "@/types/agent-ws-events"
import type { AgentEvent, ThreadMessage } from "@/types/chat-ui"

function normalizeRole(role: Message["role"]): string {
  if (typeof role !== "string") return "system"
  return role.split(".").pop()?.toLowerCase() ?? role.toLowerCase()
}

function eventId(message: Message, suffix: string): string {
  return `${message.session_id}:${message.seq}:${suffix}`
}

function toUiEvent(
  message: Message,
  suffix: string,
  payload: AgentWsEventPayload
): AgentEvent {
  return wsEventToUiEvent(payload, eventId(message, suffix))
}

type ParsedToolCall = {
  id?: string
  name: string
  arguments?: unknown
}

function parseToolCall(raw: unknown): ParsedToolCall {
  if (!raw || typeof raw !== "object") {
    return { name: "tool" }
  }

  const record = raw as Record<string, unknown>
  const fn = record.function
  if (fn && typeof fn === "object" && !Array.isArray(fn)) {
    const fnRecord = fn as Record<string, unknown>
    return {
      id: typeof record.id === "string" ? record.id : undefined,
      name:
        (typeof fnRecord.name === "string" && fnRecord.name) ||
        (typeof record.name === "string" && record.name) ||
        "tool",
      arguments: fnRecord.arguments ?? record.arguments,
    }
  }

  return {
    id: typeof record.id === "string" ? record.id : undefined,
    name: typeof record.name === "string" ? record.name : "tool",
    arguments: record.arguments,
  }
}

function assistantMessageToEvents(message: Message): AgentEvent[] {
  const events: AgentEvent[] = []
  const toolCalls = message.tool_calls ?? []

  if (message.reasoning_content) {
    events.push(
      toUiEvent(message, "thinking", {
        type: "thinking",
        text: message.reasoning_content,
      })
    )
  }

  if (message.content && toolCalls.length > 0) {
    events.push(
      toUiEvent(message, "text", {
        type: "text",
        text: message.content,
      })
    )
  }

  toolCalls.forEach((toolCall, index) => {
    const parsed = parseToolCall(toolCall)
    events.push(
      toUiEvent(message, `tool_call:${index}`, {
        type: "tool_call",
        tool: parsed.name,
        tool_call_id: parsed.id,
        arguments: parsed.arguments,
      })
    )
  })

  if (toolCalls.length === 0 && message.content) {
    events.push(
      toUiEvent(message, "text", {
        type: "text",
        text: message.content,
      })
    )
  }

  return events
}

function toolMessageToEvent(message: Message): AgentEvent {
  return toUiEvent(message, "tool_result", {
    type: "tool_result",
    tool: message.name ?? undefined,
    tool_call_id: message.tool_call_id ?? undefined,
    content: message.content,
    text: message.content,
  })
}

function isAgentBlockRole(role: string): boolean {
  return role === "assistant" || role === "tool"
}

function finalAssistantContent(block: Message[]): string {
  for (let index = block.length - 1; index >= 0; index -= 1) {
    const message = block[index]
    if (normalizeRole(message.role) !== "assistant") continue
    if (message.tool_calls?.length) continue
    if (message.content) return message.content
  }
  return ""
}

function buildAgentTurn(block: Message[]): ThreadMessage {
  const events: AgentEvent[] = []

  for (const message of block) {
    const role = normalizeRole(message.role)
    if (role === "assistant") {
      events.push(...assistantMessageToEvents(message))
      continue
    }
    if (role === "tool") {
      events.push(toolMessageToEvent(message))
    }
  }

  const summary = finalAssistantContent(block) || summaryFromEvents(events) || ""
  const first = block[0]
  const last = block[block.length - 1]

  if (summary) {
    events.push(
      toUiEvent(last, "run_completed", {
        type: "run_completed",
        text: summary,
        session_id: last.session_id,
        done: true,
      })
    )
  }

  return {
    id: `${first.session_id}:${first.seq}-${last.seq}`,
    session_id: first.session_id,
    seq: first.seq,
    role: "assistant",
    content: summary,
    events,
  }
}

export function messageToThread(message: Message): ThreadMessage {
  return {
    id: `${message.session_id}:${message.seq}`,
    session_id: message.session_id,
    seq: message.seq,
    role: message.role,
    content: message.content,
    user_id: message.user_id,
    name: message.name,
    tool_calls: message.tool_calls,
    tool_call_id: message.tool_call_id,
    reasoning_content: message.reasoning_content,
  }
}

/**
 * Reconstruct chat thread rows from persisted session messages.
 * Groups assistant/tool sequences into agent turns with `events`, mirroring
 * live WS handling in `applyAgentEvent`.
 */
export function messagesToThread(messages: Message[]): ThreadMessage[] {
  const sorted = [...messages].sort((left, right) => left.seq - right.seq)
  const thread: ThreadMessage[] = []

  let index = 0
  while (index < sorted.length) {
    const message = sorted[index]
    const role = normalizeRole(message.role)

    if (role === "system") {
      index += 1
      continue
    }

    if (role === "user") {
      thread.push(messageToThread(message))
      index += 1
      continue
    }

    if (isAgentBlockRole(role)) {
      const block: Message[] = []
      while (index < sorted.length) {
        const current = sorted[index]
        const currentRole = normalizeRole(current.role)
        if (currentRole === "user" || currentRole === "system") break
        if (isAgentBlockRole(currentRole)) {
          block.push(current)
          index += 1
          continue
        }
        index += 1
      }

      if (block.length > 0) {
        thread.push(buildAgentTurn(block))
      }
      continue
    }

    index += 1
  }

  return thread
}
