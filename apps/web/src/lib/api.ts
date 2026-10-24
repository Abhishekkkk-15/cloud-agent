import { z } from "zod"

import { defaultFileTree, defaultTerminalBoot } from "@/data/stubs"
import { messagesToThread } from "@/lib/session-messages"
import { API_BASE_URL, clearTokens, getAccessToken, http } from "@/lib/http"
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
  adminAgentConfigSchema,
  adminSandboxConfigSchema,
  adminCostAnalyticsSchema,
  planBudgetConfigSchema,
  type AdminContainerListResponse,
  type AdminContainerLogs,
  type AdminSystemStats,
  type AdminUserListResponse,
  type AdminWorkspaceListResponse,
  type AdminAgentConfig,
  type AdminSandboxConfig,
  type AdminCostAnalytics,
  type PlanBudgetConfig,
  type LLMModel,
  type CreateWorkspaceRequest,
  type CreateWorkspaceResponse,
  type FileNode,
  type FileContentResponse,
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
  sessionId: string,
  modelId?: string
): Promise<SessionDetailResponse> {
  const { data } = await http.get(`/sessions/${sessionId}`, {
    params: modelId ? { model: modelId } : undefined,
  })
  const parsed = sessionDetailResponseSchema.parse(data)
  return {
    session: parsed.session,
    messages: parsed.messages,
    context_usage: parsed.context_usage,
  }
}

export type SessionAnalyticsResponse = {
  session: {
    id: string
    title: string
    workspace_id: string
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    cached_tokens: number
    estimated_cost_usd: number
    compacted_until?: number
    has_compaction: boolean
    compaction_summary?: string
    compaction_summary_length: number
    total_messages: number
  }
  system_prompt: {
    char_count: number
    estimated_tokens: number
    content: string
  }
  tools_summary: {
    total_calls: number
    total_success: number
    total_failure: number
    failure_rate_percent: number
  }
  tools_breakdown: Array<{
    name: string
    call_count: number
    success_count: number
    failure_count: number
    total_output_chars: number
    estimated_output_tokens: number
  }>
  tool_executions: Array<{
    seq: number
    tool_call_id?: string
    tool_name: string
    arguments?: unknown
    status: "success" | "error"
    error_reason?: string
    output_preview: string
    full_output: string
    char_count: number
    estimated_tokens: number
  }>
  timeline_progression: Array<{
    seq: number
    role: string
    name?: string
    chars: number
    estimated_tokens: number
    working_context_tokens: number
  }>
}

export async function getSessionAnalytics(
  sessionId: string,
  modelId?: string
): Promise<SessionAnalyticsResponse> {
  const { data } = await http.get(`/sessions/${sessionId}/analytics`, {
    params: modelId ? { model: modelId } : undefined,
  })
  return data as SessionAnalyticsResponse
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
  try {
    const tree = await getWorkspaceFileTree(workspaceId)
    if (tree && tree.length > 0) return tree
  } catch (err) {
    console.warn("[getFileTree] Backend file tree unavailable, using fallback:", err)
  }
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
  const base = API_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:8000")
  return `${base}/workspaces/preview/${workspaceId}/`
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

// ---------------- Workspace File APIs ----------------

export async function getWorkspaceFileTree(
  workspaceId: string
): Promise<FileNode[]> {
  const { data } = await http.get(`/workspaces/${workspaceId}/files/tree`)
  return data.files ?? []
}

export async function getWorkspaceFileContent(
  workspaceId: string,
  path: string
): Promise<FileContentResponse> {
  const { data } = await http.get(`/workspaces/${workspaceId}/files/content`, {
    params: { path },
  })
  return data
}

export async function saveWorkspaceFileContent(
  workspaceId: string,
  path: string,
  content: string
): Promise<{ path: string; size: number }> {
  const { data } = await http.put(`/workspaces/${workspaceId}/files/content`, {
    path,
    content,
  })
  return data
}

export async function createWorkspaceFile(
  workspaceId: string,
  path: string,
  type: "file" | "folder" = "file",
  content = ""
): Promise<void> {
  await http.post(`/workspaces/${workspaceId}/files`, {
    path,
    type,
    content,
  })
}

export async function deleteWorkspaceFile(
  workspaceId: string,
  path: string
): Promise<void> {
  await http.delete(`/workspaces/${workspaceId}/files`, {
    params: { path },
  })
}

export async function renameWorkspaceFile(
  workspaceId: string,
  oldPath: string,
  newPath: string
): Promise<void> {
  await http.patch(`/workspaces/${workspaceId}/files/rename`, {
    old_path: oldPath,
    new_path: newPath,
  })
}

export async function downloadWorkspaceZip(
  workspaceId: string,
  workspaceTitle?: string
): Promise<void> {
  const response = await http.get(`/workspaces/${workspaceId}/download`, {
    responseType: "blob",
  })
  const blob = new Blob([response.data], { type: "application/zip" })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  const cleanTitle =
    (workspaceTitle || "project")
      .replace(/[^a-zA-Z0-9_\-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .toLowerCase() || "project"
  a.download = `${cleanTitle}.zip`
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
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

export async function getAdminAgentConfig(): Promise<AdminAgentConfig> {
  const { data } = await http.get("/admin/agent-config")
  return adminAgentConfigSchema.parse(data)
}

export async function updateAdminAgentConfig(
  body: Partial<AdminAgentConfig>
): Promise<AdminAgentConfig> {
  const { data } = await http.put("/admin/agent-config", body)
  return adminAgentConfigSchema.parse(data)
}

export async function getAdminSandboxConfig(): Promise<AdminSandboxConfig> {
  const { data } = await http.get("/admin/sandbox-config")
  return adminSandboxConfigSchema.parse(data)
}

export async function updateAdminSandboxConfig(
  body: Partial<AdminSandboxConfig>
): Promise<AdminSandboxConfig> {
  const { data } = await http.put("/admin/sandbox-config", body)
  return adminSandboxConfigSchema.parse(data)
}

export async function getAdminCostAnalytics(): Promise<AdminCostAnalytics> {
  const { data } = await http.get("/admin/costs")
  return adminCostAnalyticsSchema.parse(data)
}

export async function updateAdminPlanBudgets(
  body: Partial<PlanBudgetConfig>
): Promise<PlanBudgetConfig> {
  const { data } = await http.put("/admin/plan-budgets", body)
  return planBudgetConfigSchema.parse(data)
}




