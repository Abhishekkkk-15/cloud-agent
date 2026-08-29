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

function sessionToUpdateBody(session: Session, title: string) {
  return {
    _id: session.id,
    title,
    workspace: session.workspace,
    permissions: session.permissions,
    prompt_tokens: session.prompt_tokens,
    completion_tokens: session.completion_tokens,
    total_tokens: session.total_tokens,
    cached_tokens: session.cached_tokens,
    estimated_cost_usd: session.estimated_cost_usd,
    compaction_summary: session.compaction_summary,
    compacted_until: session.compacted_until,
    user_id: session.user_id,
    workspace_id: session.workspace_id,
    created_at: session.created_at,
    updated_at: session.updated_at,
  }
}

export async function updateSessionTitle(
  sessionId: string,
  title: string
): Promise<Session> {
  const detail = await getSessionDetail(sessionId)
  const { data } = await http.put(
    `/sessions/${sessionId}`,
    sessionToUpdateBody(detail.session, title)
  )
  return sessionSchema.parse(data)
}

function workspaceToUpdateBody(
  workspace: WorkspaceWithSession,
  title: string
) {
  return {
    title,
    user_id: workspace.user_id,
    target_path: workspace.target_path,
    source_path: workspace.source_path,
    sandbox_id: workspace.sandbox_id,
    is_active: workspace.is_active,
    initial_prompt: workspace.initial_prompt,
    status: workspace.status,
    created_at: workspace.created_at,
    updated_at: workspace.updated_at,
  }
}

export async function updateWorkspaceTitle(
  workspaceId: string,
  title: string
): Promise<WorkspaceWithSession> {
  const current = await getWorkspace(workspaceId)
  const { data } = await http.put(
    `/workspaces/${workspaceId}`,
    workspaceToUpdateBody(current, title)
  )
  return workspaceWithSessionSchema.parse(data)
}

export async function deleteSession(sessionId: string): Promise<void> {
  await http.delete(`/sessions/${sessionId}`)
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  await http.delete(`/workspaces/${workspaceId}`)
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
