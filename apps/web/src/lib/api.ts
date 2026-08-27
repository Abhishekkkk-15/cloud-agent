import { z } from "zod"

import {
  mockChatSeed,
  mockFileTrees,
  mockTerminalBoot,
} from "@/data/mock"
import { clearTokens, getAccessToken, http } from "@/lib/http"
import type { AgentActivity, AgentEvent, ThreadMessage } from "@/types/chat-ui"
import {
  createWorkspaceRequestSchema,
  createWorkspaceResponseSchema,
  tokenPairResponseSchema,
  userSchema,
  workspaceWithSessionSchema,
  type CreateWorkspaceRequest,
  type CreateWorkspaceResponse,
  type FileNode,
  type TerminalLine,
  type User,
  type WorkspaceWithSession,
} from "@cloud-agent/shared"

const delay = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms))

const fileTrees: Record<string, FileNode[]> = structuredClone(mockFileTrees)

export async function googleSignIn(credential: string) {
  const { data } = await http.post("/auth/google", { credential })
  return tokenPairResponseSchema.parse(data)
}

export async function getCurrentUser(): Promise<User | null> {
  if (!getAccessToken()) return null
  try {
    const { data } = await http.get("/auth/me")
    return userSchema.parse(data)
  } catch {
    clearTokens()
    return null
  }
}

function filterWorkspaces(
  workspaces: WorkspaceWithSession[],
  query?: string
) {
  const q = query?.trim().toLowerCase()
  if (!q) return workspaces
  return workspaces.filter(
    (workspace) =>
      workspace.title.toLowerCase().includes(q) ||
      workspace.initial_prompt.toLowerCase().includes(q)
  )
}

export async function listWorkspaces(
  query?: string
): Promise<WorkspaceWithSession[]> {
  const { data } = await http.get("/workspaces")
  const workspaces = z.array(workspaceWithSessionSchema).parse(data)
  return filterWorkspaces(workspaces, query)
}

export async function getWorkspace(id: string): Promise<WorkspaceWithSession> {
  const { data } = await http.get(`/workspaces/${id}`)
  return workspaceWithSessionSchema.parse(data)
}

export async function createWorkspace(
  input: CreateWorkspaceRequest
): Promise<CreateWorkspaceResponse> {
  const body = createWorkspaceRequestSchema.parse(input)
  const { data } = await http.post("/workspaces/new", body)
  const created = createWorkspaceResponseSchema.parse(data)
  fileTrees[created.workspace_id] = structuredClone(mockFileTrees.default)
  return created
}

export async function getFileTree(workspaceId: string): Promise<FileNode[]> {
  await delay()
  return fileTrees[workspaceId] ?? structuredClone(mockFileTrees.default)
}

export async function getTerminalBoot(): Promise<TerminalLine[]> {
  await delay(100)
  return mockTerminalBoot
}

export async function runCommand(command: string): Promise<TerminalLine[]> {
  await delay(400)
  const now = new Date().toISOString()
  const lines: TerminalLine[] = [
    {
      id: crypto.randomUUID(),
      type: "command",
      text: `$ ${command}`,
      timestamp: now,
    },
  ]

  if (command.startsWith("npm run") || command === "npm start") {
    lines.push({
      id: crypto.randomUUID(),
      type: "stdout",
      text: "VITE v6.0.0  ready in 312 ms",
      timestamp: now,
    })
    lines.push({
      id: crypto.randomUUID(),
      type: "info",
      text: "➜  Local:   https://neon-dashboard.cloudagent.dev",
      timestamp: now,
    })
  } else if (command === "ls" || command === "dir") {
    lines.push({
      id: crypto.randomUUID(),
      type: "stdout",
      text: "README.md  package.json  src",
      timestamp: now,
    })
  } else if (command.trim() === "") {
    return []
  } else {
    lines.push({
      id: crypto.randomUUID(),
      type: "stdout",
      text: `(mock) executed: ${command}`,
      timestamp: now,
    })
  }

  return lines
}

export async function getChatSeed(): Promise<ThreadMessage[]> {
  await delay(100)
  return mockChatSeed
}

export type ChatReply = {
  message: ThreadMessage
  activities: AgentActivity[]
}

function buildActivities(
  prompt: string,
  activeFile?: { id: string; name: string } | null
): AgentActivity[] {
  const lower = prompt.toLowerCase()
  const fileName = activeFile?.name ?? "App.tsx"
  const fileId = activeFile?.id
  const activities: AgentActivity[] = [
    {
      id: crypto.randomUUID(),
      type: "think",
      label: "Planning approach",
      detail: "Choosing files and next steps",
      status: "pending",
    },
  ]

  if (
    lower.includes("fix") ||
    lower.includes("error") ||
    lower.includes("edit") ||
    lower.includes("add") ||
    lower.includes("improve") ||
    lower.includes("explain")
  ) {
    activities.push({
      id: crypto.randomUUID(),
      type: "read_file",
      label: `Reading ${fileName}`,
      detail: fileName,
      status: "pending",
      fileId,
      fileName,
    })
  }

  if (
    lower.includes("fix") ||
    lower.includes("edit") ||
    lower.includes("add") ||
    lower.includes("improve") ||
    lower.includes("toggle") ||
    lower.includes("dark")
  ) {
    activities.push({
      id: crypto.randomUUID(),
      type: "edit_file",
      label: `Editing ${fileName}`,
      detail: "Applying mock patch",
      status: "pending",
      fileId,
      fileName,
    })
  }

  if (
    lower.includes("run") ||
    lower.includes("preview") ||
    lower.includes("start")
  ) {
    activities.push({
      id: crypto.randomUUID(),
      type: "run_command",
      label: "Running npm run dev",
      detail: "Starting preview runtime",
      status: "pending",
      command: "npm run dev",
    })
  }

  if (activities.length === 1) {
    activities.push({
      id: crypto.randomUUID(),
      type: "read_file",
      label: `Inspecting ${fileName}`,
      detail: fileName,
      status: "pending",
      fileId,
      fileName,
    })
  }

  return activities
}

function buildEventsFromActivities(
  prompt: string,
  activities: AgentActivity[],
  replyText: string
): AgentEvent[] {
  const sessionId = `sess_${crypto.randomUUID().slice(0, 8)}`
  const events: AgentEvent[] = [
    {
      id: crypto.randomUUID(),
      type: "RUN_STARTED",
      data: { prompt, session_id: sessionId },
    },
    {
      id: crypto.randomUUID(),
      type: "USER_MESSAGE",
      data: { text: prompt },
    },
  ]

  for (const activity of activities) {
    if (activity.type === "think") {
      events.push({
        id: activity.id,
        type: "THINKING",
        data: { text: activity.detail ?? activity.label },
      })
      continue
    }
    if (activity.type === "read_file") {
      events.push({
        id: crypto.randomUUID(),
        type: "TOOL_CALL",
        data: {
          id: `call_${activity.id}`,
          name: "read_file",
          arguments: { path: activity.fileName ?? activity.detail },
        },
      })
      continue
    }
    if (activity.type === "edit_file") {
      events.push({
        id: crypto.randomUUID(),
        type: "TOOL_CALL",
        data: {
          id: `call_${activity.id}`,
          name: "edit_file",
          arguments: { path: activity.fileName ?? activity.detail },
        },
      })
      continue
    }
    if (activity.type === "run_command") {
      events.push({
        id: crypto.randomUUID(),
        type: "TOOL_CALL",
        data: {
          id: `call_${activity.id}`,
          name: "bash",
          arguments: { command: activity.command ?? activity.label },
        },
      })
    }
  }

  events.push(
    {
      id: crypto.randomUUID(),
      type: "TEXT",
      data: { text: replyText },
    },
    {
      id: crypto.randomUUID(),
      type: "RUN_COMPLETED",
      data: { session_id: sessionId, text: replyText },
    }
  )

  return events
}

/** Mock chat send — request shape matches `ChatMessageRequest` (`query`). */
export async function sendChatMessage(
  query: string,
  activeFile?: { id: string; name: string } | null,
  attachmentCount = 0,
  sessionId = "sess_local"
): Promise<ChatReply> {
  await delay(400)
  const payload = z.object({ query: z.string().min(1) }).parse({ query })
  const fileHint = activeFile?.name ? ` in \`${activeFile.name}\`` : ""
  const attachmentHint =
    attachmentCount > 0
      ? `\n\nI see ${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"} on your message (mock — not uploaded).`
      : ""
  const activities = buildActivities(payload.query, activeFile)
  const content = `Here's a mock response for "${payload.query}"${fileHint}.${attachmentHint}\n\nI inspected the workspace, ran the planned steps above, and prepared a suggested change. Wire this to your real agent backend when ready.`
  const events = buildEventsFromActivities(payload.query, activities, content)
  const message: ThreadMessage = {
    id: crypto.randomUUID(),
    session_id: sessionId,
    seq: Date.now(),
    role: "assistant",
    content,
    activities,
    events,
  }
  return { message, activities }
}
