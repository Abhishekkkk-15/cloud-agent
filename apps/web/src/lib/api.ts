import axios from "axios"
import { z } from "zod"

import {
  mockChatSeed,
  mockFileTrees,
  mockProjects,
  mockTerminalBoot,
} from "@/data/mock"
import { clearTokens, getAccessToken, http } from "@/lib/http"
import {
  createProjectSchema,
  projectSchema,
  userSchema,
  type AgentActivity,
  type ChatMessage,
  type CreateProjectInput,
  type FileNode,
  type Project,
  type TerminalLine,
  type User,
} from "@cloud-agent/shared"

const delay = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms))

let projects = [...mockProjects]
const fileTrees: Record<string, FileNode[]> = structuredClone(mockFileTrees)

export const api = axios.create({
  baseURL: "/api",
  timeout: 8000,
})

api.interceptors.request.use(async (config) => {
  await delay(200 + Math.random() * 250)
  return config
})

type AuthPayload = {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export async function googleSignIn(credential: string): Promise<AuthPayload> {
  const { data } = await http.post("/auth/google", { credential })
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: data.token_type,
    user: userSchema.parse(data.user),
  }
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

export async function listProjects(query?: string): Promise<Project[]> {
  await delay()
  const q = query?.trim().toLowerCase()
  const filtered = q
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.language.toLowerCase().includes(q)
      )
    : projects
  return z.array(projectSchema).parse(filtered)
}

export async function getProject(id: string): Promise<Project> {
  await delay()
  const project = projects.find((p) => p.id === id)
  if (!project) throw new Error("Project not found")
  return projectSchema.parse(project)
}

export async function createProject(
  input: CreateProjectInput
): Promise<Project> {
  await delay(500)
  const data = createProjectSchema.parse(input)
  const now = new Date().toISOString()
  const project: Project = {
    id: `proj_${crypto.randomUUID().slice(0, 8)}`,
    name: data.name,
    description: data.description || `${data.template} project`,
    language:
      data.template === "python-flask"
        ? "python"
        : data.template === "static-html"
          ? "html"
          : data.language,
    visibility: data.visibility,
    starCount: 0,
    isStarred: false,
    updatedAt: now,
    createdAt: now,
    ownerUsername: mockUser.username,
  }
  projects = [project, ...projects]
  fileTrees[project.id] = structuredClone(mockFileTrees.default)
  return projectSchema.parse(project)
}

export async function toggleStar(id: string): Promise<Project> {
  await delay(150)
  projects = projects.map((p) => {
    if (p.id !== id) return p
    const isStarred = !p.isStarred
    return {
      ...p,
      isStarred,
      starCount: Math.max(0, p.starCount + (isStarred ? 1 : -1)),
    }
  })
  const project = projects.find((p) => p.id === id)
  if (!project) throw new Error("Project not found")
  return projectSchema.parse(project)
}

export async function getFileTree(projectId: string): Promise<FileNode[]> {
  await delay()
  return fileTrees[projectId] ?? structuredClone(mockFileTrees.default)
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

export async function getChatSeed(): Promise<ChatMessage[]> {
  await delay(100)
  return mockChatSeed
}

export type ChatReply = {
  message: ChatMessage
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

  if (lower.includes("run") || lower.includes("preview") || lower.includes("start")) {
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

export async function sendChatMessage(
  prompt: string,
  activeFile?: { id: string; name: string } | null,
  attachmentCount = 0
): Promise<ChatReply> {
  await delay(400)
  const fileHint = activeFile?.name ? ` in \`${activeFile.name}\`` : ""
  const attachmentHint =
    attachmentCount > 0
      ? `\n\nI see ${attachmentCount} attachment${attachmentCount === 1 ? "" : "s"} on your message (mock — not uploaded).`
      : ""
  const activities = buildActivities(prompt, activeFile)
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: `Here's a mock response for "${prompt}"${fileHint}.${attachmentHint}\n\nI inspected the workspace, ran the planned steps above, and prepared a suggested change. Wire this to your real agent backend when ready.`,
    createdAt: new Date().toISOString(),
    activities,
  }
  return { message, activities }
}
