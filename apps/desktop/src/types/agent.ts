export type AgentStatus = 'connected' | 'busy' | 'standby' | 'disconnected'

export interface AgentInfo {
  id: string
  name: string
  cliName: string
  version: string
  status: AgentStatus
  description: string
  activeModel: string
  models: string[]
  isAutonomous: boolean
}

export interface ProjectWorkspace {
  id: string
  name: string
  path: string
  gitBranch?: string
  gitClean?: boolean
  filesCount?: number
  lastOpenedAt: string
}

export type ToolStatus = 'running' | 'completed' | 'failed' | 'needs_approval'

export interface ToolCall {
  id: string
  name: string
  description: string
  status: ToolStatus
  args: Record<string, unknown>
  output?: string
  error?: string
  diff?: {
    path: string
    oldContent?: string
    newContent?: string
    stats?: { additions: number; deletions: number }
  }
  executionTimeMs?: number
}

export interface AskUserPrompt {
  id: string
  type: 'command_approval' | 'file_approval' | 'multiple_choice' | 'text'
  title: string
  description: string
  command?: string
  options?: string[]
  status: 'pending' | 'approved' | 'rejected'
  response?: string
}

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  thought?: string
  thoughtDurationMs?: number
  toolCalls?: ToolCall[]
  askUser?: AskUserPrompt
  attachments?: Array<{
    name: string
    size: number
    type: 'file' | 'image'
    previewUrl?: string
  }>
}

export interface AgentSession {
  id: string
  title: string
  projectId: string
  agentId: string
  modelId: string
  createdAt: string
  updatedAt: string
  tokenUsage: {
    prompt: number
    completion: number
    total: number
  }
}
