import { create } from "zustand"
import type {
  AgentInfo,
  AgentMessage,
  AgentSession,
  ProjectWorkspace,
} from "@/types/agent"

const MOCK_AGENTS: AgentInfo[] = [
  {
    id: "antigravity",
    name: "Antigravity CLI",
    cliName: "agy",
    version: "v2.4.1",
    status: "connected",
    description: "DeepMind Advanced Autonomous Coding Agent",
    activeModel: "Gemini 2.5 Pro",
    models: ["Gemini 2.5 Pro", "Claude 3.7 Sonnet", "Claude 3.5 Sonnet"],
    isAutonomous: false,
  },
  {
    id: "claude-code",
    name: "Claude Code",
    cliName: "claude",
    version: "v1.0.8",
    status: "connected",
    description: "Anthropic Terminal Agent with subagent support",
    activeModel: "Claude 3.7 Sonnet",
    models: ["Claude 3.7 Sonnet", "Claude 3.5 Sonnet", "Claude 3.5 Haiku"],
    isAutonomous: true,
  },
  {
    id: "aider",
    name: "Aider CLI",
    cliName: "aider",
    version: "v0.72.0",
    status: "standby",
    description: "Git-integrated Pair Programming CLI",
    activeModel: "DeepSeek V3",
    models: ["DeepSeek V3", "GPT-4o", "Claude 3.7 Sonnet"],
    isAutonomous: true,
  },
  {
    id: "goose",
    name: "Goose CLI",
    cliName: "goose",
    version: "v1.2.0",
    status: "standby",
    description: "Block's Open Extensible Coding Agent",
    activeModel: "GPT-4o",
    models: ["GPT-4o", "Claude 3.7 Sonnet"],
    isAutonomous: false,
  },
]

const MOCK_PROJECTS: ProjectWorkspace[] = [
  {
    id: "p1",
    name: "cloud-agent",
    path: "D:/python/cloud-agent",
    gitBranch: "main",
    gitClean: false,
    filesCount: 142,
    lastOpenedAt: "Just now",
  },
  {
    id: "p2",
    name: "nextjs-commerce",
    path: "C:/Users/USE05/projects/nextjs-commerce",
    gitBranch: "feat/stripe-checkout",
    gitClean: true,
    filesCount: 89,
    lastOpenedAt: "2 hours ago",
  },
  {
    id: "p3",
    name: "fastapi-microservices",
    path: "D:/backend/services",
    gitBranch: "develop",
    gitClean: false,
    filesCount: 64,
    lastOpenedAt: "Yesterday",
  },
]

const MOCK_SESSIONS: AgentSession[] = [
  {
    id: "s1",
    title: "Implement WebRTC DataChannel Signaling Relay",
    projectId: "p1",
    agentId: "antigravity",
    modelId: "Gemini 2.5 Pro",
    createdAt: "10:30 AM",
    updatedAt: "10:45 AM",
    tokenUsage: { prompt: 14200, completion: 3200, total: 17400 },
  },
  {
    id: "s2",
    title: "Add Stripe Webhook Verification and Idempotency",
    projectId: "p2",
    agentId: "claude-code",
    modelId: "Claude 3.7 Sonnet",
    createdAt: "Yesterday",
    updatedAt: "Yesterday",
    tokenUsage: { prompt: 28400, completion: 6100, total: 34500 },
  },
  {
    id: "s3",
    title: "Fix Redis Cache Invalidation race condition",
    projectId: "p3",
    agentId: "aider",
    modelId: "DeepSeek V3",
    createdAt: "Sep 22",
    updatedAt: "Sep 22",
    tokenUsage: { prompt: 8900, completion: 1200, total: 10100 },
  },
]

const INITIAL_MESSAGES: AgentMessage[] = [
  {
    id: "m1",
    role: "user",
    content:
      "We need to set up direct P2P WebRTC data channels between our desktop app daemon and web/mobile clients. Can you inspect our package.json and determine the cleanest native library for Node.js?",
    timestamp: "10:30 AM",
  },
  {
    id: "m2",
    role: "assistant",
    content:
      "I investigated the WebRTC landscape for our local daemon. **`node-datachannel`** is by far the cleanest choice for our host bridge.\n\n### Why `node-datachannel`?\n- **Native libdatachannel bindings:** Lightweight C++ library (< 5MB runtime footprint).\n- **Zero Chromium or browser bloat:** Unlike deprecated `node-webrtc` / `wrtc`, it does not pull large web engines.\n- **SCTP DataChannel support:** Direct UDP hole-punching with built-in DTLS encryption.",
    timestamp: "10:31 AM",
    thought:
      "Comparing node-datachannel vs wrtc vs simple-peer in Node.js...\nChecking memory overhead and platform prebuild binaries for Windows x64 and macOS arm64...\nAnalyzing libdatachannel reliability in CLI background daemons.",
    thoughtDurationMs: 1420,
    toolCalls: [
      {
        id: "t1",
        name: "read_file",
        description: "Read package.json dependencies",
        status: "completed",
        args: { path: "package.json", limit: 30 },
        output: "Found 12 dependencies, no existing WebRTC libraries.",
        executionTimeMs: 110,
      },
      {
        id: "t2",
        name: "run_command",
        description: "Check npm registry for node-datachannel",
        status: "completed",
        args: { command: "npm view node-datachannel version" },
        output: "0.9.3",
        executionTimeMs: 380,
      },
    ],
  },
  {
    id: "m3",
    role: "user",
    content:
      "Awesome. Let's install node-datachannel and draft our PeerConnectionManager.",
    timestamp: "10:32 AM",
  },
  {
    id: "m4",
    role: "assistant",
    content:
      "I have drafted the `PeerConnectionManager.ts` service with automatic STUN server resolution and DataChannel listeners. \n\nBefore running the installation command on your local machine, please review and approve the request below.",
    timestamp: "10:33 AM",
    thought:
      "Writing PeerConnectionManager with connection lifecycle events...\nPreparing package installation step.\nDetecting safe execution boundary: CLI command requires user confirmation.",
    thoughtDurationMs: 1850,
    toolCalls: [
      {
        id: "t3",
        name: "write_file",
        description: "Create src/webrtc/PeerConnectionManager.ts",
        status: "completed",
        args: { path: "src/webrtc/PeerConnectionManager.ts" },
        diff: {
          path: "src/webrtc/PeerConnectionManager.ts",
          stats: { additions: 54, deletions: 0 },
        },
        executionTimeMs: 240,
      },
      {
        id: "t4",
        name: "run_command",
        description: "Install node-datachannel package",
        status: "needs_approval",
        args: { command: "pnpm add node-datachannel" },
        executionTimeMs: 0,
      },
    ],
    askUser: {
      id: "ask-1",
      type: "command_approval",
      title: "Host Execution Permission",
      description:
        "Antigravity CLI (agy) wants to execute a terminal command on your local computer.",
      command: "pnpm add node-datachannel",
      status: "pending",
    },
  },
]

interface AgentStoreState {
  // Navigation & Hierarchy
  agents: AgentInfo[]
  projects: ProjectWorkspace[]
  sessions: AgentSession[]
  activeAgentId: string
  activeProjectId: string
  activeSessionId: string

  // Chat State
  messages: AgentMessage[]
  isStreaming: boolean
  streamingThought: string
  activeFilter: string
  sidebarOpen: boolean

  // Actions
  setActiveAgent: (agentId: string) => void
  setActiveProject: (projectId: string) => void
  setActiveSession: (sessionId: string) => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void

  // Messaging Actions
  sendMessage: (content: string, attachments?: AgentMessage["attachments"]) => Promise<void>
  approveTool: (messageId: string, toolId: string) => Promise<void>
  rejectTool: (messageId: string, toolId: string, reason?: string) => void
  createNewSession: (title?: string) => void
  deleteSession: (sessionId: string) => void
  renameSession: (sessionId: string, newTitle: string) => void
  clearMessages: () => void
  toggleAgentAutonomous: (agentId: string) => void
  setAgentModel: (agentId: string, model: string) => void
}

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  agents: MOCK_AGENTS,
  projects: MOCK_PROJECTS,
  sessions: MOCK_SESSIONS,
  activeAgentId: "antigravity",
  activeProjectId: "p1",
  activeSessionId: "s1",

  messages: INITIAL_MESSAGES,
  isStreaming: false,
  streamingThought: "",
  activeFilter: "all",
  sidebarOpen: true,

  setActiveAgent: (agentId) => set({ activeAgentId: agentId }),
  setActiveProject: (projectId) => {
    const sessions = get().sessions.filter((s) => s.projectId === projectId)
    set({
      activeProjectId: projectId,
      activeSessionId: sessions[0]?.id || "",
    })
  },
  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  sendMessage: async (content, attachments) => {
    const userMsg: AgentMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      attachments,
    }

    set((state) => ({
      messages: [...state.messages, userMsg],
      isStreaming: true,
      streamingThought: "Analyzing instruction and inspecting local project context...",
    }))

    // Simulate Agent Step 1: Thinking trace
    await new Promise((r) => setTimeout(r, 1200))
    set({ streamingThought: "Synthesizing solution, reading AST and planning modifications..." })

    // Simulate Agent Step 2: Tool execution
    await new Promise((r) => setTimeout(r, 1400))

    const assistantMsg: AgentMessage = {
      id: `msg-${Date.now() + 1}`,
      role: "assistant",
      content: `I've analyzed your request: **"${content.slice(0, 60)}${content.length > 60 ? "..." : ""}"**\n\nEverything is set up properly in the workspace. The command succeeded and all type definitions are aligned.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      thought:
        "Parsed prompt and mapped dependencies.\nEvaluated file boundaries and verified TypeScript typing.",
      thoughtDurationMs: 2150,
      toolCalls: [
        {
          id: `tool-${Date.now()}`,
          name: "verify_workspace",
          description: "Inspect project health and build status",
          status: "completed",
          args: { check: "types", target: "src" },
          output: "✨ 0 errors found in 142 files.",
          executionTimeMs: 310,
        },
      ],
    }

    set((state) => ({
      messages: [...state.messages, assistantMsg],
      isStreaming: false,
      streamingThought: "",
    }))
  },

  approveTool: async (messageId, toolId) => {
    // Optimistically mark tool as running
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== messageId) return m
        return {
          ...m,
          toolCalls: m.toolCalls?.map((t) =>
            t.id === toolId ? { ...t, status: "running" as const } : t
          ),
          askUser: m.askUser
            ? { ...m.askUser, status: "approved" as const }
            : undefined,
        }
      }),
    }))

    // Simulate execution time
    await new Promise((r) => setTimeout(r, 1800))

    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== messageId) return m
        return {
          ...m,
          toolCalls: m.toolCalls?.map((t) =>
            t.id === toolId
              ? {
                  ...t,
                  status: "completed" as const,
                  output:
                    "+ node-datachannel@0.9.3 added in 1.4s\nPackages: +1\nProgress: done",
                  executionTimeMs: 1420,
                }
              : t
          ),
        }
      }),
    }))
  },

  rejectTool: (messageId, toolId, reason) => {
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id !== messageId) return m
        return {
          ...m,
          toolCalls: m.toolCalls?.map((t) =>
            t.id === toolId
              ? { ...t, status: "failed" as const, error: reason || "User rejected execution" }
              : t
          ),
          askUser: m.askUser
            ? {
                ...m.askUser,
                status: "rejected" as const,
                response: reason || "Rejected by user",
              }
            : undefined,
        }
      }),
    }))
  },

  createNewSession: (title) => {
    const state = get()
    const activeProject = state.projects.find((p) => p.id === state.activeProjectId)
    const newSession: AgentSession = {
      id: `session-${Date.now()}`,
      title: title || `New Task in ${activeProject?.name || "Workspace"}`,
      projectId: state.activeProjectId,
      agentId: state.activeAgentId,
      modelId: "Gemini 2.5 Pro",
      createdAt: "Just now",
      updatedAt: "Just now",
      tokenUsage: { prompt: 0, completion: 0, total: 0 },
    }

    set((s) => ({
      sessions: [newSession, ...s.sessions],
      activeSessionId: newSession.id,
      messages: [],
    }))
  },

  deleteSession: (sessionId) => {
    set((state) => {
      const remaining = state.sessions.filter((s) => s.id !== sessionId)
      return {
        sessions: remaining,
        activeSessionId:
          state.activeSessionId === sessionId ? remaining[0]?.id || "" : state.activeSessionId,
      }
    })
  },

  renameSession: (sessionId, newTitle) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, title: newTitle } : s
      ),
    }))
  },

  clearMessages: () => set({ messages: [] }),

  toggleAgentAutonomous: (agentId) => {
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId ? { ...a, isAutonomous: !a.isAutonomous } : a
      ),
    }))
  },

  setAgentModel: (agentId, model) => {
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === agentId ? { ...a, activeModel: model } : a
      ),
    }))
  },
}))
