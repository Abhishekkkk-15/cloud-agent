import type { AgentActivity, AgentEvent, AgentEventType } from "@cloud-agent/shared"

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

function toolTarget(data: Record<string, unknown>): string | undefined {
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
  return (
    asString(data.target) ??
    asString(data.path) ??
    asString(data.file) ??
    asString(data.name)
  )
}

export type AgentActionKind =
  | "think"
  | "read"
  | "edit"
  | "create"
  | "run"
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
  return {
    kind: "tool",
    label: target ? `${name} · ${target}` : name,
  }
}

export function actionsFromEvents(events: AgentEvent[]): AgentActionItem[] {
  const items: AgentActionItem[] = []

  for (const event of events) {
    if (!isActionEvent(event.type)) continue
    const data = event.data

    if (event.type === "THINKING" || event.type === "THINKING_DELTA") {
      const text = eventText(event)
      items.push({
        id: event.id,
        kind: "think",
        label: "Thinking",
        detail: text,
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
      const input = data.input_tokens ?? data.prompt_tokens
      const output = data.output_tokens ?? data.completion_tokens
      items.push({
        id: event.id,
        kind: "usage",
        label: "Token usage",
        detail: [input != null && `in ${String(input)}`, output != null && `out ${String(output)}`]
          .filter(Boolean)
          .join(" · "),
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
