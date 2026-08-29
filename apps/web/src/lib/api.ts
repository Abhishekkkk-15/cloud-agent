import { z } from "zod"

import { defaultFileTree, defaultTerminalBoot } from "@/data/stubs"
import { messagesToThread } from "@/lib/session-messages"
import { clearTokens, getAccessToken, http } from "@/lib/http"
import {
  createWorkspaceRequestSchema,
  createWorkspaceResponseSchema,
  sessionDetailResponseSchema,
  sessionSchema,
  tokenPairResponseSchema,
  userSchema,
  workspaceWithSessionSchema,
  type CreateWorkspaceRequest,
  type CreateWorkspaceResponse,
  type FileNode,
  type Session,
  type SessionDetailResponse,
  type TerminalLine,
  type User,
  type WorkspaceWithSession,
} from "@cloud-agent/shared"

const fileTrees: Record<string, FileNode[]> = {}

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
  fileTrees[created.workspace_id] = [...defaultFileTree]
  return created
}

export async function createSession(workspaceId: string): Promise<Session> {
  const { data } = await http.post("/sessions/", null, {
    params: { workspace_id: workspaceId },
  })
  return sessionSchema.parse(data)
}

export async function getSessionDetail(
  sessionId: string
): Promise<SessionDetailResponse> {
  const { data } = await http.get(`/sessions/${sessionId}`)
  const parsed = sessionDetailResponseSchema.parse(data)
  return {
    session: parsed.session,
    messages: parsed.messages,
  }
}

export async function getSessionMessages(sessionId: string) {
  const detail = await getSessionDetail(sessionId)
  return messagesToThread(detail.messages, detail.session)
}

export async function getFileTree(workspaceId: string): Promise<FileNode[]> {
  return fileTrees[workspaceId] ?? [...defaultFileTree]
}

export async function getTerminalBoot(): Promise<TerminalLine[]> {
  return defaultTerminalBoot
}

export async function runCommand(command: string): Promise<TerminalLine[]> {
  const trimmed = command.trim()
  if (!trimmed) return []

  return [
    {
      id: crypto.randomUUID(),
      type: "command",
      text: `$ ${trimmed}`,
      timestamp: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      type: "info",
      text: "Terminal is not connected to the sandbox yet.",
      timestamp: new Date().toISOString(),
    },
  ]
}
