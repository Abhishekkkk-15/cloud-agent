import { z } from "zod";

/** Matches `PublicUser` / auth responses */
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  plan: z.enum(["free", "hacker", "pro"]),
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

/** Matches `Workspace` — snake_case API fields */
export const workspaceSchema = z.object({
  id: z.string().nullable(),
  title: z.string(),
  user_id: z.string(),
  target_path: z.string(),
  source_path: z.string(),
  sandbox_id: z.string().nullable(),
  is_active: z.boolean(),
  initial_prompt: z.string(),
  status: workspaceStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
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
  sessions: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
    }),
  ),
});

export const createWorkspaceRequestSchema = z.object({
  prompt: z.string().min(1),
});

/** Ad-hoc create response from `create_workspace` */
export const createWorkspaceResponseSchema = z.object({
  workspace_id: z.string(),
  redirect_url: z.string(),
  workspace_name: z.string(),
});

export const workspaceListResponseSchema = z.object({
  workspaces: z.array(workspaceSchema),
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

/** Matches `MongoSessionDocument` */
export const sessionSchema = z.object({
  id: z.string(),
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
export type MessageRole = z.infer<typeof messageRoleSchema>;
export type Message = z.infer<typeof messageSchema>;
export type SandboxRunResult = z.infer<typeof sandboxRunResultSchema>;
export type TerminalLine = z.infer<typeof terminalLineSchema>;
export type RunSession = z.infer<typeof runSessionSchema>;
