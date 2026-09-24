import { create } from "zustand"
import { toast } from "sonner"
import type {
  FileNode,
  RunSession,
  TerminalLine,
  Workspace,
  WorkspaceWithSession,
  Session,
} from "@cloud-agent/shared"
import type { ReasoningEffort } from "@/types/models"
import type { ChatAttachment, ThreadMessage } from "@/types/chat-ui"

export interface AgentInfo {
  id: string
  name: string
  cliName: string
  version: string
  status: "connected" | "busy" | "standby" | "disconnected"
  description: string
  activeModel: string
  models: string[]
  isAutonomous: boolean
}

const INITIAL_AGENTS: AgentInfo[] = [
  {
    id: "antigravity",
    name: "Antigravity CLI",
    cliName: "agy",
    version: "v2.4.1",
    status: "connected",
    description: "DeepMind Advanced Autonomous Coding Agent",
    activeModel: "Gemini 2.5 Pro",
    models: ["Gemini 2.5 Pro", "Claude 3.7 Sonnet", "Claude 3.5 Sonnet", "GPT-4o"],
    isAutonomous: false,
  },
  {
    id: "claude-code",
    name: "Claude Code",
    cliName: "claude",
    version: "v1.2.0",
    status: "connected",
    description: "Anthropic Direct Terminal Coding Assistant",
    activeModel: "Claude 3.7 Sonnet",
    models: ["Claude 3.7 Sonnet", "Claude 3.5 Sonnet"],
    isAutonomous: false,
  },
  {
    id: "aider",
    name: "Aider CLI",
    cliName: "aider",
    version: "v0.54.0",
    status: "connected",
    description: "Git-centric Pair Programming CLI",
    activeModel: "Claude 3.5 Sonnet",
    models: ["Claude 3.5 Sonnet", "DeepSeek R1", "GPT-4o"],
    isAutonomous: true,
  },
  {
    id: "goose",
    name: "Goose",
    cliName: "goose",
    version: "v1.0.8",
    status: "standby",
    description: "Block Open Source Autonomous Extensible Agent",
    activeModel: "GPT-4o",
    models: ["GPT-4o", "Claude 3.7 Sonnet", "Mistral Large"],
    isAutonomous: false,
  },
]

function makeWorkspace(id: string, title: string, targetPath: string): Workspace {
  return {
    id,
    title,
    user_id: "user-local",
    target_path: targetPath,
    source_path: null,
    sandbox_id: null,
    is_active: true,
    initial_prompt: "",
    status: "ready",
    created_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    updated_at: new Date().toISOString(),
    frontend_port: null,
    backend_port: null,
    preview_url: null,
  }
}

function makeWorkspaceWithSession(
  id: string,
  title: string,
  targetPath: string,
  sessions: { id: string; title: string }[]
): WorkspaceWithSession {
  return {
    ...makeWorkspace(id, title, targetPath),
    sessions,
  }
}

const INITIAL_WORKSPACES: WorkspaceWithSession[] = [
  makeWorkspaceWithSession(
    "ws-cloud-agent",
    "cloud-agent",
    "D:/python/cloud-agent",
    [
      { id: "sess-webrtc", title: "Refactor WebRTC P2P DataChannel" },
      { id: "sess-ast", title: "Optimize AST parser and token ring" },
      { id: "sess-tauri", title: "Setup Tauri native window handlers" },
    ]
  ),
  makeWorkspaceWithSession(
    "ws-course-rec",
    "course_recommendation",
    "D:/js/course_recommendation",
    [
      { id: "sess-vector", title: "Integrate Vector Search with Pinecone" },
      { id: "sess-tailwind", title: "Migrate UI to Tailwind v4 & Base UI" },
    ]
  ),
  makeWorkspaceWithSession(
    "ws-fastapi",
    "fastapi-microservices",
    "D:/python/microservices",
    [
      { id: "sess-jwt", title: "Implement JWT rotation & Redis cache" },
    ]
  ),
]

const INITIAL_FILES: FileNode[] = [
  {
    id: "dir-src",
    name: "src",
    type: "folder",
    path: "src",
    children: [
      {
        id: "dir-webrtc",
        name: "webrtc",
        type: "folder",
        path: "src/webrtc",
        children: [
          {
            id: "file-channel",
            name: "channel.ts",
            type: "file",
            path: "src/webrtc/channel.ts",
          },
          {
            id: "file-daemon",
            name: "daemon.ts",
            type: "file",
            path: "src/webrtc/daemon.ts",
          },
          {
            id: "file-signaling",
            name: "signaling.ts",
            type: "file",
            path: "src/webrtc/signaling.ts",
          },
        ],
      },
      {
        id: "dir-components",
        name: "components",
        type: "folder",
        path: "src/components",
        children: [
          {
            id: "file-app",
            name: "App.tsx",
            type: "file",
            path: "src/components/App.tsx",
          },
        ],
      },
      {
        id: "file-index",
        name: "index.ts",
        type: "file",
        path: "src/index.ts",
      },
    ],
  },
  {
    id: "file-pkg",
    name: "package.json",
    type: "file",
    path: "package.json",
  },
  {
    id: "file-readme",
    name: "README.md",
    type: "file",
    path: "README.md",
  },
  {
    id: "file-tsconfig",
    name: "tsconfig.json",
    type: "file",
    path: "tsconfig.json",
  },
]

const INITIAL_FILE_CONTENTS: Record<string, string> = {
  "file-channel": `export class WebRtcDataChannel {
  private peer: RTCPeerConnection | null = null
  private channel: RTCDataChannel | null = null
  public latencyMs = 1

  constructor(private readonly peerId: string) {}

  public async connect(): Promise<boolean> {
    console.log("[P2P DataChannel] Connecting to local daemon via direct RTC channel...")
    return true
  }

  public send(payload: unknown): void {
    if (this.channel?.readyState === "open") {
      this.channel.send(JSON.stringify(payload))
    }
  }
}`,
  "file-daemon": `import { spawn } from "node:child_process"

export class LocalAgentDaemon {
  private activeCli: "agy" | "claude" | "aider" | "goose" = "agy"

  public async launchAgent(cli: string) {
    console.log(\`Starting coding agent: \${cli}\`)
  }
}`,
  "file-signaling": `export interface SignalingPayload {
  type: "offer" | "answer" | "candidate"
  sdp?: string
  candidate?: RTCIceCandidateInit
}`,
  "file-app": `export function App() {
  return <div className="h-screen w-screen bg-background" />
}`,
  "file-index": `export * from "./webrtc/channel"
export * from "./webrtc/daemon"`,
  "file-pkg": `{
  "name": "@cloud-agent/desktop",
  "version": "0.1.0",
  "private": true
}`,
  "file-readme": `# Cloud Agent Desktop
Direct P2P WebRTC controller for local coding agents (agy, claude, aider, goose).`,
  "file-tsconfig": `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "strict": true
  }
}`,
}

const INITIAL_CHAT_MESSAGES: Record<string, ThreadMessage[]> = {
  "sess-webrtc": [
    {
      id: "msg-1",
      session_id: "sess-webrtc",
      seq: 1,
      role: "user",
      content:
        "Please establish a direct WebRTC DataChannel connection with the local agent daemon so we can stream file edits and run CLI commands without touching cloud servers.",
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "msg-2",
      session_id: "sess-webrtc",
      seq: 2,
      role: "assistant",
      content:
        "I've configured the zero-relay WebRTC P2P DataChannel in `src/webrtc/channel.ts` and wired it into `src/webrtc/daemon.ts`. The connection operates with a 1ms local round-trip latency.\n\nTo finalize and verify everything, I'm proposing to execute `pnpm test:e2e`.",
      created_at: new Date(Date.now() - 3500000).toISOString(),
      events: [
        {
          id: "ev-1",
          type: "THINKING",
          data: {
            text: "Inspecting host network interface and establishing direct RTCDataChannel with local daemon over 127.0.0.1:41829. Signaling done via ephemeral handshake.",
            durationMs: 3820,
          },
        },
        {
          id: "ev-2",
          type: "TOOL_CALL",
          data: {
            id: "tool-edit-channel",
            name: "edit_file",
            file: "src/webrtc/channel.ts",
            diff: "+  public latencyMs = 1\n+  public async connect(): Promise<boolean>",
            status: "done",
          },
        },
        {
          id: "ev-3",
          type: "PERMISSION_REQUEST",
          data: {
            id: "req-pnpm-test",
            command: "pnpm test:e2e",
            description: "Execute P2P DataChannel end-to-end integration tests on local daemon",
            status: "pending",
          },
        },
      ],
    },
  ],
}

function flattenFiles(nodes: FileNode[], acc: FileNode[] = []): FileNode[] {
  for (const node of nodes) {
    if (node.type === "file") acc.push(node)
    if (node.children) flattenFiles(node.children, acc)
  }
  return acc
}

export type WorkspaceState = {
  // Multi-workspace & sessions
  workspaces: WorkspaceWithSession[]
  workspace: Workspace | null
  activeSessionId: string | null
  pendingNewSession: boolean
  loading: boolean
  error: string | null

  // Agents
  agents: AgentInfo[]
  activeAgentId: string
  setActiveAgent: (id: string) => void
  setAgentModel: (agentId: string, model: string) => void
  toggleAgentAutonomous: (agentId: string) => void

  // Models & effort
  selectedModel: string
  selectedEffort: ReasoningEffort
  setSelectedModel: (model: string) => void
  setSelectedEffort: (effort: ReasoningEffort) => void

  // Chat
  chatMessages: ThreadMessage[]
  chatLoading: boolean
  streamingMessageId: string | null
  sendChat: (prompt: string, attachments?: ChatAttachment[]) => Promise<void>
  stopStreaming: () => void
  submitUserAnswer: (requestId: string, answers: Record<string, unknown> | boolean, reason?: string) => Promise<void>

  // Context usage
  contextUsage: {
    filled_tokens: number
    total_tokens: number
    percent_used: number
    compact_at_tokens?: number
    model_limit?: number
  }

  // Files & Editor
  files: FileNode[]
  filesLoading: boolean
  openFileIds: string[]
  activeFileId: string | null
  filesDirty: Record<string, boolean>
  fileContents: Record<string, string>
  fetchFiles: () => Promise<void>
  getActiveFile: () => FileNode | null
  setActiveFile: (id: string | null) => void
  openFile: (id: string) => void
  closeFile: (id: string) => void
  getFileContent: (id: string) => string
  updateActiveContent: (content: string) => void
  saveActiveFile: () => Promise<void>
  createFile: (name: string, type: "file" | "folder") => Promise<void>
  deleteFile: (id: string) => Promise<void>
  renameFile: (id: string, name: string) => Promise<void>

  // Terminal & Run
  terminalLines: TerminalLine[]
  runSession: RunSession
  startRun: () => Promise<void>
  stopRun: () => Promise<void>

  // Layout tabs (NO preview!)
  workspaceTab: "code" | "console"
  setWorkspaceTab: (tab: "code" | "console") => void
  chatCollapsed: boolean
  setChatCollapsed: (collapsed: boolean) => void
  sidebarOpen: boolean
  toggleSidebar: () => void

  // Multi-workspace session management actions
  switchWorkspace: (workspaceId: string) => void
  switchSession: (sessionId: string) => void
  createSessionForWorkspace: (workspaceId: string, title?: string) => Promise<Session>
  renameWorkspace: (workspaceId: string, title: string) => Promise<void>
  renameSession: (workspaceId: string, sessionId: string, title: string) => Promise<void>
  removeWorkspace: (workspaceId: string) => Promise<void>
  removeSession: (workspaceId: string, sessionId: string) => Promise<void>
  loadWorkspace: (workspaceId: string, sessionId?: string | null, opts?: { startFresh?: boolean }) => Promise<void>
  teardownConnection: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => {
  const initialWs = INITIAL_WORKSPACES[0]
  const initialSession = initialWs.sessions[0]

  return {
    workspaces: INITIAL_WORKSPACES,
    workspace: makeWorkspace(initialWs.id ?? "ws-cloud-agent", initialWs.title, initialWs.target_path),
    activeSessionId: initialSession.id,
    pendingNewSession: false,
    loading: false,
    error: null,

    agents: INITIAL_AGENTS,
    activeAgentId: "antigravity",
    setActiveAgent: (id) => {
      set({ activeAgentId: id })
      const agent = get().agents.find((a) => a.id === id)
      if (agent) {
        toast.success(`Switched to ${agent.name}`, {
          description: `CLI: ${agent.cliName} · Model: ${agent.activeModel}`,
        })
      }
    },
    setAgentModel: (agentId, model) => {
      set((state) => ({
        agents: state.agents.map((a) =>
          a.id === agentId ? { ...a, activeModel: model } : a
        ),
        selectedModel: model.toLowerCase().replace(/\s+/g, "-"),
      }))
      toast.info(`Model updated to ${model}`)
    },
    toggleAgentAutonomous: (agentId) => {
      set((state) => ({
        agents: state.agents.map((a) =>
          a.id === agentId ? { ...a, isAutonomous: !a.isAutonomous } : a
        ),
      }))
    },

    selectedModel: "gemini-2.5-pro",
    selectedEffort: "high",
    setSelectedModel: (model) => set({ selectedModel: model }),
    setSelectedEffort: (effort) => set({ selectedEffort: effort }),

    chatMessages: INITIAL_CHAT_MESSAGES["sess-webrtc"] ?? [],
    chatLoading: false,
    streamingMessageId: null,

    sendChat: async (prompt, _attachments) => {
      const activeSessionId = get().activeSessionId
      if (!activeSessionId || !prompt.trim()) return

      const userMsgId = `usr-${Date.now()}`
      const asstMsgId = `asst-${Date.now()}`
      const activeAgent = get().agents.find((a) => a.id === get().activeAgentId)

      const userMsg: ThreadMessage = {
        id: userMsgId,
        session_id: activeSessionId,
        seq: get().chatMessages.length + 1,
        role: "user",
        content: prompt,
        created_at: new Date().toISOString(),
      }

      set((state) => ({
        chatMessages: [...state.chatMessages, userMsg],
        chatLoading: true,
        streamingMessageId: asstMsgId,
      }))

      // Realistic response simulation matching agent event turns
      await new Promise((r) => setTimeout(r, 600))

      const asstMsg: ThreadMessage = {
        id: asstMsgId,
        session_id: activeSessionId,
        seq: get().chatMessages.length + 2,
        role: "assistant",
        content: `I've processed your instruction using **${activeAgent?.name || "Agent"}** (${activeAgent?.activeModel}). The changes have been verified over direct WebRTC P2P DataChannel.`,
        created_at: new Date().toISOString(),
        events: [
          {
            id: `think-${Date.now()}`,
            type: "THINKING",
            data: {
              text: `Analyzing codebase structure, validating dependencies, and formatting response for ${activeAgent?.name}.`,
              durationMs: 1420,
            },
          },
          {
            id: `tool-${Date.now()}`,
            type: "TOOL_CALL",
            data: {
              id: `tool-${Date.now()}`,
              name: "read_file",
              file: "src/webrtc/channel.ts",
              status: "done",
            },
          },
        ],
      }

      set((state) => ({
        chatMessages: [...state.chatMessages, asstMsg],
        chatLoading: false,
        streamingMessageId: null,
      }))
    },

    stopStreaming: () => {
      set({ chatLoading: false, streamingMessageId: null })
    },

    submitUserAnswer: async (requestId, answers, reason) => {
      const isApproved = typeof answers === "boolean" ? answers : true
      set((state) => ({
        chatMessages: state.chatMessages.map((msg) => {
          if (!msg.events) return msg
          return {
            ...msg,
            events: msg.events.map((ev) => {
              if (ev.type === "PERMISSION_REQUEST" && ev.data.id === requestId) {
                return {
                  ...ev,
                  data: {
                    ...ev.data,
                    status: isApproved ? "approved" : "rejected",
                    reason: reason || undefined,
                    answers: typeof answers === "object" ? answers : undefined,
                  },
                }
              }
              return ev
            }),
          }
        }),
      }))

      if (isApproved) {
        toast.success("Command approved and executed via local daemon")
      } else {
        toast.warning("Command execution rejected", { description: reason })
      }
    },

    contextUsage: {
      filled_tokens: 38400,
      total_tokens: 128000,
      percent_used: 30.0,
      compact_at_tokens: 100000,
      model_limit: 128000,
    },

    files: INITIAL_FILES,
    filesLoading: false,
    openFileIds: ["file-channel", "file-daemon"],
    activeFileId: "file-channel",
    filesDirty: {},
    fileContents: INITIAL_FILE_CONTENTS,

    fetchFiles: async () => {},

    getActiveFile: () => {
      const activeId = get().activeFileId
      if (!activeId) return null
      const flat = flattenFiles(get().files)
      return flat.find((f) => f.id === activeId) ?? null
    },

    setActiveFile: (id) => set({ activeFileId: id }),

    openFile: (id) => {
      set((state) => {
        const alreadyOpen = state.openFileIds.includes(id)
        return {
          openFileIds: alreadyOpen ? state.openFileIds : [...state.openFileIds, id],
          activeFileId: id,
        }
      })
    },

    closeFile: (id) => {
      set((state) => {
        const newOpen = state.openFileIds.filter((fId) => fId !== id)
        let newActive = state.activeFileId
        if (state.activeFileId === id) {
          newActive = newOpen.length > 0 ? newOpen[newOpen.length - 1] : null
        }
        return {
          openFileIds: newOpen,
          activeFileId: newActive,
        }
      })
    },

    getFileContent: (id) => {
      return get().fileContents[id] ?? "// Empty file content"
    },

    updateActiveContent: (content) => {
      const activeId = get().activeFileId
      if (!activeId) return
      set((state) => ({
        fileContents: { ...state.fileContents, [activeId]: content },
        filesDirty: { ...state.filesDirty, [activeId]: true },
      }))
    },

    saveActiveFile: async () => {
      const activeId = get().activeFileId
      if (!activeId) return
      set((state) => ({
        filesDirty: { ...state.filesDirty, [activeId]: false },
      }))
      toast.success("File saved")
    },

    createFile: async (name, type) => {
      const newId = `file-${Date.now()}`
      const isFolder = type === "folder"
      const newNode: FileNode = {
        id: newId,
        name,
        type,
        path: name,
        children: isFolder ? [] : undefined,
      }
      set((state) => ({
        files: [...state.files, newNode],
        fileContents: isFolder ? state.fileContents : { ...state.fileContents, [newId]: "" },
      }))
      toast.success(`${isFolder ? "Folder" : "File"} created`)
    },

    deleteFile: async (id) => {
      set((state) => ({
        files: state.files.filter((f) => f.id !== id),
        openFileIds: state.openFileIds.filter((fId) => fId !== id),
        activeFileId: state.activeFileId === id ? null : state.activeFileId,
      }))
      toast.success("Deleted file")
    },

    renameFile: async (id, name) => {
      set((state) => ({
        files: state.files.map((f) => (f.id === id ? { ...f, name } : f)),
      }))
      toast.success("Renamed file")
    },

    terminalLines: [
      {
        id: "term-1",
        type: "stdout",
        text: "[daemon] Initialized WebRTC P2P DataChannel on 127.0.0.1:41829",
        timestamp: new Date(Date.now() - 300000).toISOString(),
      },
      {
        id: "term-2",
        type: "stdout",
        text: "[daemon] Coding agents connected: agy (v2.4.1), claude (v1.2.0), aider (v0.54.0)",
        timestamp: new Date(Date.now() - 240000).toISOString(),
      },
      {
        id: "term-3",
        type: "stdout",
        text: "[tauri] Frameless desktop window running at 1280x820",
        timestamp: new Date(Date.now() - 180000).toISOString(),
      },
    ],

    runSession: {
      id: "run-local",
      status: "idle",
      url: null,
      startedAt: null,
    },

    startRun: async () => {
      set({
        runSession: { id: "run-local", status: "running", url: null, startedAt: new Date().toISOString() },
      })
      toast.success("Workspace build & run started")
    },

    stopRun: async () => {
      set({
        runSession: { id: "run-local", status: "idle", url: null, startedAt: null },
      })
      toast.info("Process stopped")
    },

    // Default to 'code' tab (NO preview!)
    workspaceTab: "code",
    setWorkspaceTab: (tab) => set({ workspaceTab: tab }),

    chatCollapsed: false,
    setChatCollapsed: (collapsed) => set({ chatCollapsed: collapsed }),

    sidebarOpen: true,
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

    switchWorkspace: (workspaceId) => {
      const ws = get().workspaces.find((w) => w.id === workspaceId)
      if (!ws) return
      const firstSession = ws.sessions[0]
      set({
        workspace: makeWorkspace(ws.id ?? workspaceId, ws.title, ws.target_path),
        activeSessionId: firstSession ? firstSession.id : null,
        chatMessages: firstSession ? INITIAL_CHAT_MESSAGES[firstSession.id] || [] : [],
      })
      toast.info(`Switched to workspace: ${ws.title}`)
    },

    switchSession: (sessionId) => {
      set({
        activeSessionId: sessionId,
        chatMessages: INITIAL_CHAT_MESSAGES[sessionId] || [],
      })
    },

    createSessionForWorkspace: async (workspaceId, title) => {
      const newSession: Session = {
        id: `sess-${Date.now()}`,
        title: title || `Session ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        workspace: workspaceId,
        workspace_id: workspaceId,
        user_id: "user-local",
        permissions: {
          allow_all: true,
          allowed_tools: ["*"],
          allowed_targets: {},
        },
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        cached_tokens: 0,
        estimated_cost_usd: 0,
        compaction_summary: "",
        compacted_until: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      set((state) => ({
        workspaces: state.workspaces.map((w) =>
          w.id === workspaceId ? { ...w, sessions: [{ id: newSession.id, title: newSession.title }, ...w.sessions] } : w
        ),
        activeSessionId: newSession.id,
        chatMessages: [],
      }))

      toast.success(`Created session: ${newSession.title}`)
      return newSession
    },

    renameWorkspace: async (workspaceId, title) => {
      set((state) => ({
        workspaces: state.workspaces.map((w) =>
          w.id === workspaceId ? { ...w, title } : w
        ),
        workspace:
          state.workspace?.id === workspaceId
            ? { ...state.workspace, title }
            : state.workspace,
      }))
    },

    renameSession: async (workspaceId, sessionId, title) => {
      set((state) => ({
        workspaces: state.workspaces.map((w) =>
          w.id === workspaceId
            ? {
                ...w,
                sessions: w.sessions.map((s) =>
                  s.id === sessionId ? { ...s, title } : s
                ),
              }
            : w
        ),
      }))
    },

    removeWorkspace: async (workspaceId) => {
      set((state) => {
        const nextWorkspaces = state.workspaces.filter((w) => w.id !== workspaceId)
        const nextWs = nextWorkspaces[0] ?? null
        return {
          workspaces: nextWorkspaces,
          workspace: nextWs
            ? makeWorkspace(nextWs.id ?? "ws-default", nextWs.title, nextWs.target_path)
            : null,
          activeSessionId: nextWs?.sessions[0]?.id ?? null,
        }
      })
      toast.success("Workspace deleted")
    },

    removeSession: async (workspaceId, sessionId) => {
      set((state) => ({
        workspaces: state.workspaces.map((w) =>
          w.id === workspaceId
            ? {
                ...w,
                sessions: w.sessions.filter((s) => s.id !== sessionId),
              }
            : w
        ),
        activeSessionId:
          state.activeSessionId === sessionId ? null : state.activeSessionId,
      }))
      toast.success("Session deleted")
    },

    loadWorkspace: async (workspaceId, sessionId) => {
      const ws = get().workspaces.find((w) => w.id === workspaceId)
      if (ws) {
        set({
          workspace: makeWorkspace(ws.id ?? workspaceId, ws.title, ws.target_path),
          activeSessionId: sessionId || ws.sessions[0]?.id || null,
        })
      }
    },

    teardownConnection: () => {},
  }
})
