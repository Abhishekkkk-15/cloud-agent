import { z } from "zod"

import { messageRoleSchema } from "@cloud-agent/shared"

/** pi_sdk `EventType` values used by the chat UI event trail. */
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

export const chatAttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number().nonnegative(),
  kind: z.enum(["image", "file"]),
  previewUrl: z.string().optional(),
})

/**
 * Chat thread row for the workspace UI.
 * Core fields align with `MongoMessageDocument`; `id` / `events` / `attachments`
 * / `activities` are client-only enrichments for rendering.
 */
export const threadMessageSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  seq: z.number().int(),
  role: z.union([messageRoleSchema, z.string()]),
  content: z.string().default(""),
  user_id: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  tool_calls: z.array(z.unknown()).nullable().optional(),
  tool_call_id: z.string().nullable().optional(),
  reasoning_content: z.string().nullable().optional(),
  events: z.array(agentEventSchema).optional(),
  activities: z.array(agentActivitySchema).optional(),
  attachments: z.array(chatAttachmentSchema).optional(),
})

export type AgentEventType = z.infer<typeof agentEventTypeSchema>
export type AgentEvent = z.infer<typeof agentEventSchema>
export type AgentActivity = z.infer<typeof agentActivitySchema>
export type ChatAttachment = z.infer<typeof chatAttachmentSchema>
export type ThreadMessage = z.infer<typeof threadMessageSchema>
