import { z } from "zod"

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  plan: z.enum(["free", "hacker", "pro"]),
})

export const projectLanguageSchema = z.enum([
  "typescript",
  "javascript",
  "python",
  "go",
  "rust",
  "html",
])

export const projectSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  description: z.string(),
  language: projectLanguageSchema,
  visibility: z.enum(["public", "private"]),
  starCount: z.number().int().nonnegative(),
  isStarred: z.boolean(),
  updatedAt: z.string(),
  createdAt: z.string(),
  ownerUsername: z.string(),
})

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(60, "Name is too long")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens"),
  description: z.string().max(200).optional().default(""),
  language: projectLanguageSchema,
  visibility: z.enum(["public", "private"]).default("private"),
  template: z.enum([
    "blank",
    "react-vite",
    "express-api",
    "python-flask",
    "static-html",
  ]),
})

export const fileNodeSchema: z.ZodType<FileNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(["file", "folder"]),
    language: z.string().optional(),
    content: z.string().optional(),
    children: z.array(fileNodeSchema).optional(),
  })
)

export type FileNode = {
  id: string
  name: string
  type: "file" | "folder"
  language?: string
  content?: string
  children?: FileNode[]
}

export const terminalLineSchema = z.object({
  id: z.string(),
  type: z.enum(["command", "stdout", "stderr", "info"]),
  text: z.string(),
  timestamp: z.string(),
})

export const agentActivitySchema = z.object({
  id: z.string(),
  type: z.enum(["read_file", "edit_file", "run_command", "think"]),
  label: z.string(),
  detail: z.string().optional(),
  status: z.enum(["pending", "running", "done", "error"]),
  fileId: z.string().optional(),
  fileName: z.string().optional(),
  command: z.string().optional(),
})

export const agentEventTypeSchema = z.enum([
  "RUN_STARTED",
  "USER_MESSAGE",
  "THINKING_DELTA",
  "THINKING",
  "TEXT_DELTA",
  "TEXT",
  "TOOL_CALL",
  "TOOL_RESULT",
  "PERMISSION_REQUEST",
  "COMPACTION",
  "USAGE",
  "ERROR",
  "STATUS",
  "RUN_COMPLETED",
  "RUN_FAILED",
])

export const agentEventSchema = z.object({
  id: z.string(),
  type: agentEventTypeSchema,
  data: z.record(z.string(), z.unknown()).default({}),
})

export const chatAttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number().nonnegative(),
  kind: z.enum(["image", "file"]),
  previewUrl: z.string().optional(),
})

export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  createdAt: z.string(),
  activities: z.array(agentActivitySchema).optional(),
  events: z.array(agentEventSchema).optional(),
  attachments: z.array(chatAttachmentSchema).optional(),
})

export const runSessionSchema = z.object({
  id: z.string(),
  status: z.enum(["idle", "starting", "running", "stopped", "error"]),
  url: z.string().nullable(),
  startedAt: z.string().nullable(),
})

export type User = z.infer<typeof userSchema>
export type Project = z.infer<typeof projectSchema>
export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type TerminalLine = z.infer<typeof terminalLineSchema>
export type AgentActivity = z.infer<typeof agentActivitySchema>
export type AgentEventType = z.infer<typeof agentEventTypeSchema>
export type AgentEvent = z.infer<typeof agentEventSchema>
export type ChatAttachment = z.infer<typeof chatAttachmentSchema>
export type ChatMessage = z.infer<typeof chatMessageSchema>
export type RunSession = z.infer<typeof runSessionSchema>
export type ProjectLanguage = z.infer<typeof projectLanguageSchema>
