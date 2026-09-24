import type { AgentActivity, AgentEvent, AgentEventType } from "@/types/chat-ui"

/** Shortcut: event.text ≈ data.text | data.content */
export function eventText(event: AgentEvent): string | undefined {
  const text = event.data.text
  const content = event.data.content
  if (typeof text === "string" && text.length > 0) return text
  if (typeof content === "string" && content.length > 0) return content
  return undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function formatTokenCount(value: number): string {
  return value.toLocaleString()
}

export function formatUsageDetail(data: Record<string, unknown>): string {
  const input = asNumber(data.input_tokens) ?? asNumber(data.prompt_tokens)
  const output = asNumber(data.output_tokens) ?? asNumber(data.completion_tokens)
  const cached = asNumber(data.cached_tokens)
  const total =
    asNumber(data.total_tokens) ??
    (input != null && output != null ? input + output : undefined)
  const cost = asNumber(data.estimated_cost_usd) ?? asNumber(data.session_estimated_cost_usd)

  const parts: string[] = []
  if (input != null) parts.push(`in ${formatTokenCount(input)}`)
  if (output != null) parts.push(`out ${formatTokenCount(output)}`)
  if (cached != null && cached > 0) {
    parts.push(`cached ${formatTokenCount(cached)}`)
  }
  if (total != null) parts.push(`total ${formatTokenCount(total)}`)
  if (cost != null && cost > 0) parts.push(`$${cost.toFixed(4)}`)
  return parts.join(" · ")
}

function toolTarget(data: Record<string, unknown>): string | undefined {
  // Prefer slim top-level target from live WS (no full arguments payload).
  const direct =
    asString(data.target) ?? asString(data.path) ?? asString(data.file)
  if (direct) return direct

  const args = data.arguments
  if (args && typeof args === "object" && !Array.isArray(args)) {
    const record = args as Record<string, unknown>
    return (
      asString(record.path) ??
      asString(record.file) ??
      asString(record.target) ??
      asString(record.command)
    )
  }
  return asString(data.name)
}

export type AgentActionKind =
  | "think"
  | "read"
  | "edit"
  | "create"
  | "run"
  | "git"
  | "permission"
  | "status"
  | "usage"
  | "error"
  | "compact"
  | "tool"

export type AgentActionItem = {
  id: string
  kind: AgentActionKind
  label: string
  detail?: string
  fileId?: string
  running?: boolean
}

const ACTION_EVENT_TYPES = new Set<AgentEventType>([
  "THINKING",
  "THINKING_DELTA",
  "TOOL_CALL",
  "TOOL_RESULT",
  "PERMISSION_REQUEST",
  "COMPACTION",
  "USAGE",
  "ERROR",
  "STATUS",
])

export function isActionEvent(type: AgentEventType) {
  return ACTION_EVENT_TYPES.has(type)
}

function statusMessage(event: AgentEvent): string {
  return asString(event.data.message) ?? eventText(event) ?? ""
}

/** Key for merging repeated streaming STATUS rows (e.g. tool arg progress). */
export function statusEventKey(event: AgentEvent): string | null {
  if (event.type !== "STATUS") return null
  const message = statusMessage(event)
  const match = message.match(/^Generating arguments for (.+?) \(/)
  if (match) return `tool-args:${match[1].trim()}`
  return message || "status"
}

export function coalesceAgentEvents(events: AgentEvent[]): AgentEvent[] {
  const result: AgentEvent[] = []
  let accumulatedUsage: AgentEvent | null = null

  for (const event of events) {
    if (event.type === "USAGE") {
      if (!accumulatedUsage) {
        accumulatedUsage = { ...event, data: { ...event.data } }
      } else {
        const prevData: Record<string, unknown> = accumulatedUsage.data || {}
        const currData: Record<string, unknown> = event.data || {}

        const pIn = asNumber(prevData.prompt_tokens) ?? asNumber(prevData.input_tokens) ?? 0
        const pOut = asNumber(prevData.completion_tokens) ?? asNumber(prevData.output_tokens) ?? 0
        const pCached = asNumber(prevData.cached_tokens) ?? 0
        const pCost = asNumber(prevData.estimated_cost_usd) ?? 0

        const cIn = asNumber(currData.prompt_tokens) ?? asNumber(currData.input_tokens) ?? 0
        const cOut = asNumber(currData.completion_tokens) ?? asNumber(currData.output_tokens) ?? 0
        const cCached = asNumber(currData.cached_tokens) ?? 0
        const cCost = asNumber(currData.estimated_cost_usd) ?? 0

        const sumIn = pIn + cIn
        const sumOut = pOut + cOut
        const sumCached = pCached + cCached
        const sumCost = pCost + cCost

        const currentUsage: AgentEvent = accumulatedUsage
        accumulatedUsage = {
          ...currentUsage,
          data: {
            ...prevData,
            ...currData,
            prompt_tokens: sumIn,
            completion_tokens: sumOut,
            cached_tokens: sumCached,
            total_tokens: sumIn + sumOut,
            estimated_cost_usd: sumCost,
            session_prompt_tokens: currData.session_prompt_tokens ?? prevData.session_prompt_tokens,
            session_completion_tokens: currData.session_completion_tokens ?? prevData.session_completion_tokens,
            session_total_tokens: currData.session_total_tokens ?? prevData.session_total_tokens,
            session_cached_tokens: currData.session_cached_tokens ?? prevData.session_cached_tokens,
            session_estimated_cost_usd: currData.session_estimated_cost_usd ?? prevData.session_estimated_cost_usd,
          },
        }
      }
      continue
    }

    if (result.length > 0) {
      const previous = result[result.length - 1]

      const key = statusEventKey(event)
      if (key && statusEventKey(previous) === key) {
        result[result.length - 1] = event
        continue
      }

      if (event.type === "THINKING_DELTA") {
        if (previous.type === "THINKING_DELTA") {
          const prevText = eventText(previous) ?? ""
          const newText = eventText(event) ?? ""
          result[result.length - 1] = {
            ...previous,
            data: {
              ...previous.data,
              text: prevText + newText,
            },
          }
          continue
        }
      }

      if (event.type === "THINKING") {
        if (previous.type === "THINKING_DELTA" || previous.type === "THINKING") {
          const text = eventText(event) || eventText(previous) || ""
          result[result.length - 1] = {
            ...event,
            data: {
              ...event.data,
              text,
            },
          }
          continue
        }
      }
    }

    result.push(event)
  }

  if (accumulatedUsage) {
    result.push(accumulatedUsage)
  }

  return result
}

export function appendAgentEvent(
  events: AgentEvent[],
  event: AgentEvent
): AgentEvent[] {
  if (event.type === "USAGE") {
    const existingIndex = events.findIndex((e) => e.type === "USAGE")
    if (existingIndex >= 0) {
      const prev = events[existingIndex]
      const prevData = prev.data || {}
      const nextData = event.data || {}

      const pIn = asNumber(prevData.prompt_tokens) ?? asNumber(prevData.input_tokens) ?? 0
      const pOut = asNumber(prevData.completion_tokens) ?? asNumber(prevData.output_tokens) ?? 0
      const pCached = asNumber(prevData.cached_tokens) ?? 0
      const pCost = asNumber(prevData.estimated_cost_usd) ?? 0

      const nIn = asNumber(nextData.prompt_tokens) ?? asNumber(nextData.input_tokens) ?? 0
      const nOut = asNumber(nextData.completion_tokens) ?? asNumber(nextData.output_tokens) ?? 0
      const nCached = asNumber(nextData.cached_tokens) ?? 0
      const nCost = asNumber(nextData.estimated_cost_usd) ?? 0

      const sumIn = pIn + nIn
      const sumOut = pOut + nOut
      const sumCached = pCached + nCached
      const sumCost = pCost + nCost

      const updated: AgentEvent = {
        ...prev,
        data: {
          ...prevData,
          ...nextData,
          prompt_tokens: sumIn,
          completion_tokens: sumOut,
          cached_tokens: sumCached,
          total_tokens: sumIn + sumOut,
          estimated_cost_usd: sumCost,
          session_prompt_tokens: nextData.session_prompt_tokens ?? prevData.session_prompt_tokens,
          session_completion_tokens: nextData.session_completion_tokens ?? prevData.session_completion_tokens,
          session_total_tokens: nextData.session_total_tokens ?? prevData.session_total_tokens,
          session_cached_tokens: nextData.session_cached_tokens ?? prevData.session_cached_tokens,
          session_estimated_cost_usd: nextData.session_estimated_cost_usd ?? prevData.session_estimated_cost_usd,
        },
      }

      const nextEvents = [...events]
      nextEvents[existingIndex] = updated
      return nextEvents
    }
  }

  if (events.length > 0) {
    const previous = events[events.length - 1]

    const key = statusEventKey(event)
    if (key && statusEventKey(previous) === key) {
      return [...events.slice(0, -1), event]
    }

    if (event.type === "THINKING_DELTA") {
      if (previous.type === "THINKING_DELTA") {
        const prevText = eventText(previous) ?? ""
        const newText = eventText(event) ?? ""
        const updated: AgentEvent = {
          ...previous,
          data: {
            ...previous.data,
            text: prevText + newText,
          },
        }
        return [...events.slice(0, -1), updated]
      }
    }

    if (event.type === "THINKING") {
      if (previous.type === "THINKING_DELTA" || previous.type === "THINKING") {
        const text = eventText(event) || eventText(previous) || ""
        const updated: AgentEvent = {
          ...event,
          data: {
            ...event.data,
            text,
          },
        }
        return [...events.slice(0, -1), updated]
      }
    }
  }

  return [...events, event]
}

function toolCallLabel(name: string, target?: string): {
  kind: AgentActionKind
  label: string
} {
  const lower = name.toLowerCase()
  if (lower.includes("read") || lower === "read_file") {
    return {
      kind: "read",
      label: target ? `Read ${target}` : `Read with ${name}`,
    }
  }
  if (
    lower.includes("write") ||
    lower.includes("edit") ||
    lower.includes("create") ||
    lower === "edit_file" ||
    lower === "write_file"
  ) {
    const created = lower.includes("create") || lower.includes("write")
    return {
      kind: created ? "create" : "edit",
      label: target
        ? `${created ? "Created" : "Edited"} ${target}`
        : `${created ? "Created" : "Edited"} via ${name}`,
    }
  }
  if (lower.includes("bash") || lower.includes("shell") || lower.includes("run")) {
    return {
      kind: "run",
      label: target ? `Ran ${target}` : `Ran ${name}`,
    }
  }
  if (lower.startsWith("git_") || lower === "git") {
    const actionName = lower.replace(/^git_/, "")
    return {
      kind: "git",
      label: target ? `git ${actionName} · ${target}` : `git ${actionName}`,
    }
  }
  return {
    kind: "tool",
    label: target ? `${name} · ${target}` : name,
  }
}

export function actionsFromEvents(events: AgentEvent[]): AgentActionItem[] {
  const items: AgentActionItem[] = []

  for (const event of coalesceAgentEvents(events)) {
    if (!isActionEvent(event.type)) continue
    const data = event.data

    if (event.type === "THINKING" || event.type === "THINKING_DELTA") {
      const text = eventText(event)
      const isStreaming = event.type === "THINKING_DELTA"
      items.push({
        id: event.id,
        kind: "think",
        label: isStreaming ? "Thinking…" : "Thought process",
        detail: text,
        running: isStreaming,
      })
      continue
    }

    if (event.type === "TOOL_CALL") {
      const name = asString(data.name) ?? "tool"
      const target = toolTarget(data)
      const { kind, label } = toolCallLabel(name, target)
      items.push({
        id: event.id,
        kind,
        label,
        detail: asString(data.id),
      })
      continue
    }

    if (event.type === "TOOL_RESULT") {
      // Prefer TOOL_CALL rows; results are shown via pairing in the stream.
      continue
    }

    if (event.type === "PERMISSION_REQUEST") {
      const tool = asString(data.tool) ?? "tool"
      const target = asString(data.target)
      items.push({
        id: event.id,
        kind: "permission",
        label: target ? `Approval · ${tool} ${target}` : `Approval · ${tool}`,
        detail: asString(data.details),
      })
      continue
    }

    if (event.type === "COMPACTION") {
      items.push({
        id: event.id,
        kind: "compact",
        label: "Compacted context",
        detail: asString(data.message) ?? eventText(event),
      })
      continue
    }

    if (event.type === "USAGE") {
      items.push({
        id: event.id,
        kind: "usage",
        label: "Token usage",
        detail: formatUsageDetail(data),
      })
      continue
    }

    if (event.type === "ERROR") {
      items.push({
        id: event.id,
        kind: "error",
        label: "Error",
        detail: asString(data.error) ?? eventText(event),
      })
      continue
    }

    if (event.type === "STATUS") {
      items.push({
        id: event.id,
        kind: "status",
        label: asString(data.message) ?? eventText(event) ?? "Status update",
      })
    }
  }

  return items
}

export function actionsFromActivities(
  activities: AgentActivity[]
): AgentActionItem[] {
  return activities.map((activity) => {
    const kind: AgentActionKind =
      activity.type === "think"
        ? "think"
        : activity.type === "read_file"
          ? "read"
          : activity.type === "edit_file"
            ? "edit"
            : "run"
    return {
      id: activity.id,
      kind,
      label: activity.label,
      detail: activity.command ?? activity.detail,
      fileId: activity.fileId,
      running: activity.status === "running" || activity.status === "pending",
    }
  })
}

export function summaryFromEvents(events: AgentEvent[]): string | undefined {
  const finals = events.filter((e) => e.type === "TEXT" || e.type === "TEXT_DELTA")
  if (finals.length === 0) return undefined
  const last = finals[finals.length - 1]
  return eventText(last)
}
