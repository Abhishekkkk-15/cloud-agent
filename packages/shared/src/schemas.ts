import { z } from "zod";

/** Matches `PublicUser` / auth responses */
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  plan: z.enum(["free", "hacker", "pro"]),
  role: z.enum(["user", "admin"]).default("user"),
  isActive: z.boolean().default(true).optional(),
  githubConnected: z.boolean().default(false),
  githubLogin: z.string().nullable().default(null),
});

export const googleAuthRequestSchema = z.object({
  credential: z.string().min(20),
});

export const refreshTokenRequestSchema = z.object({
  refresh_token: z.string().min(20),
});

export const tokenPairResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string().default("bearer"),
  user: userSchema,
});

export const registerUserRequestSchema = z.object({
  name: z.string(),
  email: z.string(),
  password: z.string(),
});

export const registerUserResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});

/** Matches `WorkspaceStatus` */
export const workspaceStatusSchema = z.enum([
  "pending",
  "running",
  "ready",
  "failed",
]);

const isoTimestamp = z
  .union([z.string(), z.date()])
  .transform((value) => (value instanceof Date ? value.toISOString() : value));

/** Matches `Workspace` — snake_case API fields */
export const workspaceSchema = z.object({
  id: z.string().nullable(),
  title: z.string(),
  user_id: z.string(),
  target_path: z.string(),
  source_path: z.string().nullable(),
  sandbox_id: z.string().nullable(),
  is_active: z.boolean(),
  initial_prompt: z.string(),
  status: workspaceStatusSchema,
  created_at: isoTimestamp,
  updated_at: isoTimestamp,
  frontend_port: z.number().nullable(),
  backend_port: z.number().nullable(),
  preview_url: z.string().nullable(),
  github_repo_full_name: z.string().nullable().optional(),
  github_repo_url: z.string().nullable().optional(),
  github_clone_url: z.string().nullable().optional(),
  github_default_branch: z.string().nullable().optional(),
  github_owner: z.string().nullable().optional(),
  github_name: z.string().nullable().optional(),
  github_auth_source: z.enum(["user", "platform"]).nullable().optional(),
  workspace_origin: z.enum(["template", "github_import"]).optional(),
});

/** Matches `MinimalSession` (`id` / `_id`) */
export const minimalSessionSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    title: z.string().default(""),
  })
  .transform((value) => {
    const id = value.id ?? value._id;
    if (!id) throw new Error("Session is missing id");
    return { id, title: value.title ?? "" };
  });

export const workspaceWithSessionSchema = workspaceSchema.extend({
  sessions: z.array(minimalSessionSchema),
});

export const createWorkspaceRequestSchema = z.object({
  prompt: z.string().min(1),
});

/** Ad-hoc create response from `create_workspace` */
export const createWorkspaceResponseSchema = z.object({
  workspace_id: z.string(),
  redirect_url: z.string(),
  workspace_name: z.string(),
  workspace: workspaceSchema,
});

export const workspaceListResponseSchema = z.object({
  workspaces: z.array(workspaceWithSessionSchema),
});

export const chatMessageRequestSchema = z.object({
  query: z.string().min(1),
});

export const resumeSessionMessageSchema = z.object({
  session_id: z.string().min(1),
});

export const sessionPermissionsSchema = z.object({
  allow_all: z.boolean().default(false),
  allowed_tools: z.array(z.string()).default([]),
  allowed_targets: z.record(z.string(), z.array(z.string())).default({}),
});

/** Matches `MongoSessionDocument` (`id` / `_id`) */
export const sessionSchema = z
  .object({
    id: z.string().optional(),
    _id: z.string().optional(),
    title: z.string().default(""),
    workspace: z.string(),
    permissions: sessionPermissionsSchema.default({
      allow_all: false,
      allowed_tools: [],
      allowed_targets: {},
    }),
    prompt_tokens: z.number().default(0),
    completion_tokens: z.number().default(0),
    total_tokens: z.number().default(0),
    cached_tokens: z.number().default(0),
    estimated_cost_usd: z.number().default(0),
    compaction_summary: z.string().default(""),
    compacted_until: z.number().default(0),
    user_id: z.string().nullable().optional(),
    workspace_id: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })
  .transform((value) => {
    const id = value.id ?? value._id;
    if (!id) throw new Error("Session is missing id");
    const { _id: _ignored, ...rest } = value;
    return { ...rest, id };
  });

export const createSessionRequestSchema = z.object({
  workspace_id: z.string().min(1),
});

export const messageRoleSchema = z.enum([
  "user",
  "system",
  "tool",
  "assistant",
]);

/** Matches `MongoMessageDocument` */
export const messageSchema = z.object({
  session_id: z.string(),
  seq: z.number().int(),
  role: z.union([messageRoleSchema, z.string()]),
  content: z.string().default(""),
  user_id: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  tool_calls: z.array(z.unknown()).nullable().optional(),
  tool_call_id: z.string().nullable().optional(),
  reasoning_content: z.string().nullable().optional(),
});

export const sessionDetailResponseSchema = z.object({
  session: sessionSchema,
  messages: z.array(messageSchema),
});

export const sandboxRunResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
});

/**
 * Frontend-only editor / preview helpers (no matching API schema yet).
 * Kept in shared so workspace UI can import a single package.
 */
export const fileNodeSchema: z.ZodType<FileNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(["file", "folder"]),
    language: z.string().optional(),
    content: z.string().optional(),
    children: z.array(fileNodeSchema).optional(),
  }),
);

export type FileNode = {
  id: string;
  name: string;
  type: "file" | "folder";
  language?: string;
  content?: string;
  children?: FileNode[];
};

export const terminalLineSchema = z.object({
  id: z.string(),
  type: z.enum(["command", "stdout", "stderr", "info"]),
  text: z.string(),
  timestamp: z.string(),
});

export const runSessionSchema = z.object({
  id: z.string(),
  status: z.enum(["idle", "starting", "running", "stopped", "error"]),
  url: z.string().nullable(),
  startedAt: z.string().nullable(),
});

export type User = z.infer<typeof userSchema>;
export type GoogleAuthRequest = z.infer<typeof googleAuthRequestSchema>;
export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;
export type TokenPairResponse = z.infer<typeof tokenPairResponseSchema>;
export type RegisterUserRequest = z.infer<typeof registerUserRequestSchema>;
export type RegisterUserResponse = z.infer<typeof registerUserResponseSchema>;
export type WorkspaceStatus = z.infer<typeof workspaceStatusSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;
export type MinimalSession = z.infer<typeof minimalSessionSchema>;
export type WorkspaceWithSession = z.infer<typeof workspaceWithSessionSchema>;
export type CreateWorkspaceRequest = z.infer<
  typeof createWorkspaceRequestSchema
>;
export type CreateWorkspaceResponse = z.infer<
  typeof createWorkspaceResponseSchema
>;
export type ChatMessageRequest = z.infer<typeof chatMessageRequestSchema>;
export type ResumeSessionMessage = z.infer<typeof resumeSessionMessageSchema>;
export type SessionPermissions = z.infer<typeof sessionPermissionsSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;
export type SessionDetailResponse = z.infer<typeof sessionDetailResponseSchema>;
export type MessageRole = z.infer<typeof messageRoleSchema>;
export type Message = z.infer<typeof messageSchema>;
export type SandboxRunResult = z.infer<typeof sandboxRunResultSchema>;
export type TerminalLine = z.infer<typeof terminalLineSchema>;
export type RunSession = z.infer<typeof runSessionSchema>;

export const llmModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  model_id: z.string(),
  provider: z.string(),
  url: z.string().nullable().optional(),
  base_url: z.string().nullable().optional(),
  api_key_env: z.string().nullable().optional(),
  has_api_key: z.boolean().default(false),
  is_active: z.boolean().default(true),
  is_default: z.boolean().default(false),
  supports_effort: z.boolean().default(false),
  is_multi_model: z.boolean().default(false),
  default_effort: z.string().nullable().optional(),
  use_case: z.array(z.string()).default([]),
  badge: z.string().nullable().optional(),
  description: z.string().default(""),
  context_window: z.number().nullable().optional(),
  max_tokens: z.number().nullable().optional(),
  input_price_per_mtok: z.number().default(0),
  output_price_per_mtok: z.number().default(0),
  created_at: isoTimestamp.optional(),
  updated_at: isoTimestamp.optional(),
});

export type LLMModel = z.infer<typeof llmModelSchema>;

export const githubAuthorizeResponseSchema = z.object({
  url: z.string().url(),
});

export const githubStatusResponseSchema = z.object({
  connected: z.boolean(),
  login: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export const githubRepoItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  private: z.boolean(),
  html_url: z.string(),
  clone_url: z.string(),
  default_branch: z.string(),
  description: z.string().nullable(),
  owner_login: z.string(),
  owner_avatar_url: z.string().nullable().optional(),
  updated_at: z.string().nullable(),
});

export const githubReposResponseSchema = z.object({
  repos: z.array(githubRepoItemSchema),
});

export const importGithubWorkspaceRequestSchema = z.object({
  owner: z.string().min(1),
  name: z.string().min(1),
  full_name: z.string().min(3),
  default_branch: z.string().min(1),
  clone_url: z.string().min(1),
  html_url: z.string().min(1),
  private: z.boolean().default(false),
});

export type GitHubAuthorizeResponse = z.infer<
  typeof githubAuthorizeResponseSchema
>;
export type GitHubStatusResponse = z.infer<typeof githubStatusResponseSchema>;
export type GitHubRepoItem = z.infer<typeof githubRepoItemSchema>;
export type GitHubReposResponse = z.infer<typeof githubReposResponseSchema>;
export type ImportGithubWorkspaceRequest = z.infer<
  typeof importGithubWorkspaceRequestSchema
>;

/** Admin System Health & Statistics */
export const adminDockerHealthSchema = z.object({
  status: z.enum(["online", "offline"]),
  version: z.string().nullable().optional(),
  containers_count: z.number().default(0),
  running_containers_count: z.number().default(0),
  error: z.string().nullable().optional(),
});

export const adminMongoHealthSchema = z.object({
  status: z.enum(["connected", "disconnected"]),
  ping_ms: z.number().default(0),
  error: z.string().nullable().optional(),
});

export const adminSystemResourcesSchema = z.object({
  cpu: z.object({
    percent: z.number().default(0),
    logical_cores: z.number().default(1),
    physical_cores: z.number().default(1),
  }).default({ percent: 0, logical_cores: 1, physical_cores: 1 }),
  memory: z.object({
    total_bytes: z.number().default(0),
    used_bytes: z.number().default(0),
    available_bytes: z.number().default(0),
    percent: z.number().default(0),
  }).default({ total_bytes: 0, used_bytes: 0, available_bytes: 0, percent: 0 }),
  disk: z.object({
    total_bytes: z.number().default(0),
    used_bytes: z.number().default(0),
    free_bytes: z.number().default(0),
    percent: z.number().default(0),
    path: z.string().default(""),
  }).default({ total_bytes: 0, used_bytes: 0, free_bytes: 0, percent: 0, path: "" }),
});

export type AdminSystemResources = z.infer<typeof adminSystemResourcesSchema>;

export const adminSystemStatsSchema = z.object({
  total_users: z.number().default(0),
  total_workspaces: z.number().default(0),
  total_sessions: z.number().default(0),
  total_messages: z.number().default(0),
  total_models: z.number().default(0),
  active_models: z.number().default(0),
  docker: adminDockerHealthSchema,
  mongo: adminMongoHealthSchema,
  system_resources: adminSystemResourcesSchema.optional(),
  environment: z.record(z.string(), z.unknown()).default({}),
});

export type AdminSystemStats = z.infer<typeof adminSystemStatsSchema>;

/** Admin Docker Container */
export const adminContainerSchema = z.object({
  id: z.string(),
  short_id: z.string(),
  name: z.string(),
  image: z.string(),
  status: z.string(),
  state: z.string().optional(),
  created: z.string().nullable().optional(),
  ports: z.record(z.string(), z.union([z.number(), z.string(), z.array(z.unknown())])).default({}),
  workspace_id: z.string().nullable().optional(),
});

export type AdminContainer = z.infer<typeof adminContainerSchema>;

export const adminContainerListResponseSchema = z.object({
  docker_available: z.boolean(),
  docker_error: z.string().nullable().optional(),
  containers: z.array(adminContainerSchema),
});

export type AdminContainerListResponse = z.infer<
  typeof adminContainerListResponseSchema
>;

export const adminContainerLogsSchema = z.object({
  container_id: z.string(),
  logs: z.string(),
});

export type AdminContainerLogs = z.infer<typeof adminContainerLogsSchema>;

/** Admin User Management */
export const adminUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  username: z.string(),
  avatarUrl: z.string().nullable().optional(),
  plan: z.enum(["free", "hacker", "pro"]),
  role: z.enum(["user", "admin"]),
  is_active: z.boolean().default(true),
  is_verified: z.boolean().default(false),
  githubConnected: z.boolean().default(false),
  githubLogin: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  workspaces_count: z.number().default(0),
  sessions_count: z.number().default(0),
});

export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminUserListResponseSchema = z.object({
  users: z.array(adminUserSchema),
  total: z.number(),
});

export type AdminUserListResponse = z.infer<typeof adminUserListResponseSchema>;

export const adminUpdateUserRoleRequestSchema = z.object({
  role: z.enum(["user", "admin"]),
});

export const adminUpdateUserPlanRequestSchema = z.object({
  plan: z.enum(["free", "hacker", "pro"]),
});

export const adminUpdateUserStatusRequestSchema = z.object({
  is_active: z.boolean(),
});

/** Admin Workspace Management */
export const adminWorkspaceSchema = z.object({
  id: z.string(),
  title: z.string(),
  user_id: z.string(),
  user_name: z.string().optional(),
  user_email: z.string().optional(),
  target_path: z.string(),
  sandbox_id: z.string().nullable().optional(),
  status: workspaceStatusSchema,
  frontend_port: z.number().nullable().optional(),
  backend_port: z.number().nullable().optional(),
  preview_url: z.string().nullable().optional(),
  github_repo_full_name: z.string().nullable().optional(),
  workspace_origin: z.string().optional(),
  created_at: z.string().nullable().optional(),
  sessions_count: z.number().default(0),
});

export type AdminWorkspace = z.infer<typeof adminWorkspaceSchema>;

export const adminWorkspaceListResponseSchema = z.object({
  workspaces: z.array(adminWorkspaceSchema),
  total: z.number(),
});

export type AdminWorkspaceListResponse = z.infer<
  typeof adminWorkspaceListResponseSchema
>;

/** Admin Agent Configuration */
export const adminAgentConfigSchema = z.object({
  default_model_id: z.string().nullable().default(null),
  default_effort: z.enum(["low", "medium", "high"]).default("high"),
  autonomous_mode: z.boolean().default(true),
  max_retries: z.number().int().min(1).max(10).default(3),
  compaction_enabled: z.boolean().default(true),
  compact_at_tokens: z.number().int().min(1000).default(20000),
  keep_recent_tokens: z.number().int().min(500).default(6000),
  system_prompt_prefix: z.string().nullable().default(null),
});

export type AdminAgentConfig = z.infer<typeof adminAgentConfigSchema>;

/** Admin Sandbox Container Resource Configuration */
export const adminSandboxConfigSchema = z.object({
  memory_limit_mb: z.number().int().min(256).max(65536).default(2048),
  cpu_limit: z.number().min(0.1).max(64).default(2.0),
  pids_limit: z.number().int().min(50).max(10000).default(500),
  memory_swap_limit_mb: z.number().int().default(-1),
  apply_to_running: z.boolean().default(false),
});

export type AdminSandboxConfig = z.infer<typeof adminSandboxConfigSchema>;



