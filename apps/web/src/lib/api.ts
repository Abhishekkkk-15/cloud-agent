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
  llmModelSchema,
  githubAuthorizeResponseSchema,
  githubStatusResponseSchema,
  githubReposResponseSchema,
  importGithubWorkspaceRequestSchema,
  adminContainerListResponseSchema,
  adminContainerLogsSchema,
  adminSystemStatsSchema,
  adminUserListResponseSchema,
  adminWorkspaceListResponseSchema,
  type AdminContainerListResponse,
  type AdminContainerLogs,
  type AdminSystemStats,
  type AdminUserListResponse,
  type AdminWorkspaceListResponse,
  type LLMModel,
  type CreateWorkspaceRequest,
  type CreateWorkspaceResponse,
  type FileNode,
  type Session,
  type SessionDetailResponse,
  type TerminalLine,
  type User,
  type WorkspaceWithSession,
  type GitHubRepoItem,
  type GitHubStatusResponse,
  type ImportGithubWorkspaceRequest,
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

function filterWorkspaces(workspaces: WorkspaceWithSession[], query?: string) {
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

function workspaceToUpdateBody(workspace: WorkspaceWithSession, title: string) {
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

// Preview APi

// export async function preview(
//   workspace_id: string,
//   path: string = ""
// ): Promise<string> {
//   const response = await http.get(`/workspaces/preview/${workspace_id}/${path}`)
//   return response.data
// }
export function preview(workspaceId: string): string {
  return `http://localhost:8000/workspaces/preview/${workspaceId}/`
}

export async function listModels(useCase?: string): Promise<LLMModel[]> {
  const params = useCase ? { use_case: useCase } : undefined
  const { data } = await http.get("/models", { params })
  return z.array(llmModelSchema).parse(data)
}

export async function getGitHubAuthorizeUrl(): Promise<string> {
  const { data } = await http.get("/integrations/github/authorize")
  return githubAuthorizeResponseSchema.parse(data).url
}

export async function getGitHubStatus(): Promise<GitHubStatusResponse> {
  const { data } = await http.get("/integrations/github/status")
  return githubStatusResponseSchema.parse(data)
}

export async function disconnectGitHub(): Promise<GitHubStatusResponse> {
  const { data } = await http.delete("/integrations/github")
  return githubStatusResponseSchema.parse(data)
}

export async function listGitHubRepos(query?: string): Promise<GitHubRepoItem[]> {
  const { data } = await http.get("/integrations/github/repos", {
    params: query?.trim() ? { q: query.trim() } : undefined,
  })
  return githubReposResponseSchema.parse(data).repos
}

export async function importGithubWorkspace(
  input: ImportGithubWorkspaceRequest
): Promise<CreateWorkspaceResponse> {
  const body = importGithubWorkspaceRequestSchema.parse(input)
  const { data } = await http.post("/workspaces/import", body)
  const created = createWorkspaceResponseSchema.parse(data)
  fileTrees[created.workspace_id] = [...defaultFileTree]
  return created
}

// ---------------- Admin API ----------------

export async function getAdminStats(): Promise<AdminSystemStats> {
  const { data } = await http.get("/admin/stats")
  return adminSystemStatsSchema.parse(data)
}

export async function getAdminContainers(): Promise<AdminContainerListResponse> {
  const { data } = await http.get("/admin/containers")
  return adminContainerListResponseSchema.parse(data)
}

export async function startAdminContainer(containerId: string) {
  const { data } = await http.post(`/admin/containers/${containerId}/start`)
  return data
}

export async function stopAdminContainer(containerId: string) {
  const { data } = await http.post(`/admin/containers/${containerId}/stop`)
  return data
}

export async function restartAdminContainer(containerId: string) {
  const { data } = await http.post(`/admin/containers/${containerId}/restart`)
  return data
}

export async function removeAdminContainer(containerId: string) {
  const { data } = await http.delete(`/admin/containers/${containerId}`)
  return data
}

export async function getAdminContainerLogs(
  containerId: string,
  tail = 150
): Promise<AdminContainerLogs> {
  const { data } = await http.get(`/admin/containers/${containerId}/logs`, {
    params: { tail },
  })
  return adminContainerLogsSchema.parse(data)
}

export async function pruneAdminContainers() {
  const { data } = await http.post("/admin/containers/prune")
  return data
}

export async function getAdminUsers(params?: {
  search?: string
  role?: string
  plan?: string
  limit?: number
  skip?: number
}): Promise<AdminUserListResponse> {
  const { data } = await http.get("/admin/users", { params })
  return adminUserListResponseSchema.parse(data)
}

export async function updateAdminUserRole(
  userId: string,
  role: "user" | "admin"
) {
  const { data } = await http.patch(`/admin/users/${userId}/role`, { role })
  return data
}

export async function updateAdminUserPlan(
  userId: string,
  plan: "free" | "hacker" | "pro"
) {
  const { data } = await http.patch(`/admin/users/${userId}/plan`, { plan })
  return data
}

export async function updateAdminUserStatus(userId: string, isActive: boolean) {
  const { data } = await http.patch(`/admin/users/${userId}/status`, {
    is_active: isActive,
  })
  return data
}

export async function deleteAdminUser(userId: string) {
  const { data } = await http.delete(`/admin/users/${userId}`)
  return data
}

export async function getAdminWorkspaces(params?: {
  search?: string
  status?: string
  limit?: number
  skip?: number
}): Promise<AdminWorkspaceListResponse> {
  const { data } = await http.get("/admin/workspaces", { params })
  return adminWorkspaceListResponseSchema.parse(data)
}

export async function stopAdminWorkspace(workspaceId: string) {
  const { data } = await http.post(`/admin/workspaces/${workspaceId}/stop`)
  return data
}

export async function deleteAdminWorkspace(workspaceId: string) {
  const { data } = await http.delete(`/admin/workspaces/${workspaceId}`)
  return data
}

export async function getAllModels(): Promise<LLMModel[]> {
  const { data } = await http.get("/models/all")
  return z.array(llmModelSchema).parse(data)
}

export async function createModel(
  body: Record<string, unknown>
): Promise<LLMModel> {
  const { data } = await http.post("/models", body)
  return llmModelSchema.parse(data)
}

export async function updateModel(
  modelId: string,
  body: Record<string, unknown>
): Promise<LLMModel> {
  const { data } = await http.put(`/models/${modelId}`, body)
  return llmModelSchema.parse(data)
}

export async function deleteModel(modelId: string): Promise<void> {
  await http.delete(`/models/${modelId}`)
}

export async function seedDefaultModels(): Promise<{ seeded: number }> {
  const { data } = await http.post("/models/seed")
  return data
}


