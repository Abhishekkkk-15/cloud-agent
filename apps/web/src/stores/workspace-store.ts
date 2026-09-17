import { create } from "zustand"
import { toast } from "sonner"

import {
  getFileTree,
  getSessionDetail,
  getTerminalBoot,
  getWorkspace,
  runCommand,
} from "@/lib/api"
import { messagesToThread } from "@/lib/session-messages"
import { get_wehsocket, reset_websocket } from "@/lib/websocket"
import { useWorkspaceListStore } from "@/stores/workspace-list-store"
import { appendAgentEvent } from "@/lib/agent-events"
import {
  isTerminalAgentEvent,
  wsEventToUiEvent,
  wsPayloadText,
  type AgentWsEventPayload,
  type GithubSyncWsPayload,
  type SandboxWsPayload,
} from "@/types/agent-ws-events"
import type { ChatAttachment, ThreadMessage } from "@/types/chat-ui"
import type {
  FileNode,
  RunSession,
  TerminalLine,
  Workspace,
} from "@cloud-agent/shared"
import type { ReasoningEffort } from "@/types/models"

export type SandboxStatus =
  "idle" | "starting" | "provisioning" | "resuming" | "ready" | "error"

export type SandboxState = {
  active: boolean
  status: SandboxStatus
  title: string
  message: string
  stage?: string
  details?: string
  error: string | null
  sandboxId: string | null
  previewUrl: string | null
  backendUrl: string | null
  frontendPort: number | null
  backendPort: number | null
}

function flattenFiles(nodes: FileNode[], acc: FileNode[] = []): FileNode[] {
  for (const node of nodes) {
    if (node.type === "file") acc.push(node)
    if (node.children) flattenFiles(node.children, acc)
  }
  return acc
}
export function getPreviewUrl(workspaceId: string, _port?: number): string {
  // Uses wildcard domain (e.g. lvh.me locally or production domain) routed through proxy
  const baseDomain = import.meta.env.VITE_PREVIEW_DOMAIN || "lvh.me"
  const proxyPort = import.meta.env.VITE_PREVIEW_PORT
  const isLocal =
    baseDomain === "lvh.me" ||
    baseDomain === "localhost" ||
    baseDomain === "127.0.0.1"

  let scheme = import.meta.env.VITE_PREVIEW_SCHEME
  if (!scheme) {
    if (typeof window !== "undefined" && window.location.protocol) {
      scheme = window.location.protocol.replace(":", "")
    } else {
      scheme = isLocal ? "http" : "https"
    }
  }

  let portSuffix = ""
  if (proxyPort !== undefined && proxyPort !== null && String(proxyPort).trim() !== "") {
    const p = String(proxyPort).trim()
    if (p !== "80" && p !== "443") {
      portSuffix = `:${p}`
    }
  } else if (isLocal) {
    portSuffix = ":8000"
  }

  return `${scheme}://${workspaceId}.${baseDomain}${portSuffix}`
}
function updateFileContent(
  nodes: FileNode[],
  fileId: string,
  content: string
): FileNode[] {
  return nodes.map((node) => {
    if (node.id === fileId && node.type === "file") {
      return { ...node, content }
    }
    if (node.children) {
      return {
        ...node,
        children: updateFileContent(node.children, fileId, content),
      }
    }
    return node
  })
}

export type WorkspaceTab = "preview" | "code" | "console"

type WorkspaceState = {
  workspace: Workspace | null
  activeSessionId: string | null
  /** True after "New Session" until pi_sdk creates one via session:create */
  pendingNewSession: boolean
  files: FileNode[]
  openFileIds: string[]
  activeFileId: string | null
  terminalLines: TerminalLine[]
  chatMessages: ThreadMessage[]
  runSession: RunSession
  loading: boolean
  chatLoading: boolean
  streamingMessageId: string | null
  workspaceTab: WorkspaceTab
  bottomPanel: "console" | "shell"
  error: string | null
  loadWorkspace: (
    workspaceId: string,
    sessionId?: string | null,
    options?: { startFresh?: boolean }
  ) => Promise<void>
  openFile: (fileId: string) => void
  closeFile: (fileId: string) => void
  setActiveFile: (fileId: string) => void
  updateActiveContent: (content: string) => void
  executeCommand: (command: string) => Promise<void>
  startRun: () => Promise<void>
  stopRun: () => void
  sendChat: (prompt: string, attachments?: ChatAttachment[]) => Promise<void>
  stopStreaming: () => void
  setWorkspaceTab: (tab: WorkspaceTab) => void
  setBottomPanel: (panel: "console" | "shell") => void
  getActiveFile: () => FileNode | null
  sandbox: SandboxState
  setSandboxState: (patch: Partial<SandboxState>) => void
  dismissSandbox: () => void
  retrySandbox: () => Promise<void>
  teardownConnection: () => void
  selectedModel: string
  selectedEffort: ReasoningEffort
  setSelectedModel: (model: string) => void
  setSelectedEffort: (effort: ReasoningEffort) => void
  chatCollapsed: boolean
  setChatCollapsed: (collapsed: boolean) => void
  toggleChatCollapsed: () => void
  previewKey: number
  reloadPreview: () => void
  contextUsage: {
    filled_tokens: number
    total_tokens: number
    remaining_tokens: number
    percent_used: number
    compact_at_tokens?: number
    model_limit?: number
  } | null
}

let chatAbortController: AbortController | null = null
let agentStreamUnsubscribe: (() => void) | null = null
let controlEventUnsubscribe: (() => void) | null = null
let sandboxUnsubscribe: (() => void) | null = null
let sandboxReadyTimer: ReturnType<typeof setTimeout> | null = null

function clearSandboxListener() {
  sandboxUnsubscribe?.()
  sandboxUnsubscribe = null
  if (sandboxReadyTimer) {
    clearTimeout(sandboxReadyTimer)
    sandboxReadyTimer = null
  }
}

type ActiveAgentStream = {
  assistantId: string
  textBuffer: string
}

let activeAgentStream: ActiveAgentStream | null = null

function clearAgentStreamListener() {
  agentStreamUnsubscribe?.()
  agentStreamUnsubscribe = null
  controlEventUnsubscribe?.()
  controlEventUnsubscribe = null
  activeAgentStream = null
}

function resetChatBusyState(
  set: (
    partial:
      | Partial<WorkspaceState>
      | ((state: WorkspaceState) => Partial<WorkspaceState>)
  ) => void
) {
  chatAbortController?.abort()
  chatAbortController = null
  activeAgentStream = null
  set({ chatLoading: false, streamingMessageId: null, error: null })
}

function applyAgentEvent(
  payload: AgentWsEventPayload,
  set: (
    partial:
      | Partial<WorkspaceState>
      | ((state: WorkspaceState) => Partial<WorkspaceState>)
  ) => void
) {
  if (!activeAgentStream) return

  const { assistantId } = activeAgentStream
  let { textBuffer } = activeAgentStream

  if (payload.type === "text_delta") {
    const chunk = wsPayloadText(payload) ?? ""
    if (chunk) textBuffer += chunk
  } else if (payload.type === "text") {
    const fullText = wsPayloadText(payload) ?? ""
    if (fullText) textBuffer = fullText
  } else if (payload.type === "run_completed") {
    const finalText = wsPayloadText(payload)
    if (finalText && !textBuffer) textBuffer = finalText
  } else if (payload.type === "run_failed") {
    const errorText = payload.error ?? wsPayloadText(payload)
    if (errorText && !textBuffer) textBuffer = errorText
  }

  activeAgentStream.textBuffer = textBuffer
  const uiEvent = wsEventToUiEvent(payload)

  set((state) => ({
    chatMessages: state.chatMessages.map((msg) =>
      msg.id === assistantId
        ? {
            ...msg,
            content: textBuffer || msg.content,
            events: appendAgentEvent(msg.events ?? [], uiEvent),
          }
        : msg
    ),
    ...(payload.session_id
      ? { activeSessionId: payload.session_id, pendingNewSession: false }
      : {}),
  }))

  if (isTerminalAgentEvent(payload)) {
    activeAgentStream = null
    set({ chatLoading: false, streamingMessageId: null })
    void useWorkspaceListStore.getState().fetchWorkspaces()
  }
}

function beginAgentStream(
  get: () => WorkspaceState,
  set: (
    partial:
      | Partial<WorkspaceState>
      | ((state: WorkspaceState) => Partial<WorkspaceState>)
  ) => void,
  options: {
    sessionId: string
    userContent?: string
    assistantId?: string
    attachments?: ChatAttachment[]
  }
) {
  const assistantId = options.assistantId ?? crypto.randomUUID()
  let messages = get().chatMessages

  if (options.userContent) {
    const last = messages[messages.length - 1]
    const alreadyHasUser =
      last?.role === "user" && last.content === options.userContent
    if (!alreadyHasUser) {
      messages = [
        ...messages,
        {
          id: crypto.randomUUID(),
          session_id: options.sessionId,
          seq: messages.length,
          role: "user",
          content: options.userContent,
          attachments: options.attachments?.length
            ? options.attachments
            : undefined,
        },
      ]
    }
  }

  if (!messages.some((message) => message.id === assistantId)) {
    messages = [
      ...messages,
      {
        id: assistantId,
        session_id: options.sessionId,
        seq: messages.length,
        role: "assistant",
        content: "",
        events: [],
      },
    ]
  }

  activeAgentStream = { assistantId, textBuffer: "" }
  set({
    chatMessages: messages,
    streamingMessageId: assistantId,
    chatLoading: true,
    activeSessionId: options.sessionId,
  })

  return assistantId
}

function ensureAgentStreamListener(
  ws: ReturnType<typeof get_wehsocket>,
  get: () => WorkspaceState,
  set: (
    partial:
      | Partial<WorkspaceState>
      | ((state: WorkspaceState) => Partial<WorkspaceState>)
  ) => void
) {
  if (agentStreamUnsubscribe) return

  agentStreamUnsubscribe = ws.subscribeAgentEvents((payload) => {
    if (payload.type === "run_started" && !activeAgentStream) {
      const sessionId =
        payload.session_id ??
        get().activeSessionId ??
        get().workspace?.id ??
        "local"
      const prompt = wsPayloadText(payload)
      beginAgentStream(get, set, {
        sessionId,
        userContent: prompt || undefined,
      })
    }

    if (!activeAgentStream) return
    applyAgentEvent(payload, set)
  })
}

function ensureControlEventListener(
  ws: ReturnType<typeof get_wehsocket>,
  _get: () => WorkspaceState,
  set: (
    partial:
      | Partial<WorkspaceState>
      | ((state: WorkspaceState) => Partial<WorkspaceState>)
  ) => void
) {
  if (controlEventUnsubscribe) return

  const onSessionCreate = (raw: unknown) => {
    const data = raw as { session_id?: string } | null
    const sessionId = data?.session_id
    if (!sessionId) return
    set({
      activeSessionId: sessionId,
      pendingNewSession: false,
    })
    void useWorkspaceListStore.getState().fetchWorkspaces()
  }

  const onBusy = () => {
    activeAgentStream = null
    set({
      chatLoading: false,
      streamingMessageId: null,
      error: "Agent is busy — wait for the current run to finish, or stop it.",
    })
  }

  const onError = (raw: unknown) => {
    const message =
      typeof raw === "string"
        ? raw
        : raw && typeof raw === "object" && "message" in raw
          ? String((raw as { message: unknown }).message)
          : raw != null
            ? String(raw)
            : "Agent error"
    activeAgentStream = null
    set({
      chatLoading: false,
      streamingMessageId: null,
      error: message,
    })
  }

  const GITHUB_SYNC_TOAST_ID = "github-sync"

  const onGithubSync = (raw: unknown) => {
    const data = (raw ?? {}) as GithubSyncWsPayload
    const status = data.status

    if (status === "started") {
      toast.loading("Saving workspace to GitHub…", {
        id: GITHUB_SYNC_TOAST_ID,
      })
      return
    }

    if (status === "ok") {
      const description = [
        data.commit_message,
        data.repo ? `Repo: ${data.repo}` : null,
        data.committed === false ? "No new changes to commit" : null,
      ]
        .filter(Boolean)
        .join(" · ")
      toast.success("Saved to GitHub", {
        id: GITHUB_SYNC_TOAST_ID,
        description: description || undefined,
      })
      return
    }

    if (status === "error") {
      toast.error("GitHub sync failed", {
        id: GITHUB_SYNC_TOAST_ID,
        description: data.error || data.error_code || "Unknown error",
      })
    }
  }

  const onBudgetExceeded = (raw: unknown) => {
    activeAgentStream = null
    const data = raw as { message?: string }
    const msg = data?.message || "Monthly budget exceeded."
    set({
      chatLoading: false,
      streamingMessageId: null,
      error: msg,
    })
    toast.error("Monthly Budget Exceeded", {
      description: msg,
      duration: 10000,
    })
  }

  const onBudgetWarning = (raw: unknown) => {
    const data = raw as { message?: string }
    if (data?.message) {
      toast.warning("Monthly Budget Notice", {
        description: data.message,
        duration: 8000,
      })
    }
  }

  const onContextUsage = (raw: unknown) => {
    const data = raw as {
      filled_tokens?: number
      total_tokens?: number
      remaining_tokens?: number
      percent_used?: number
      compact_at_tokens?: number
      model_limit?: number
    }
    if (data && typeof data.filled_tokens === "number") {
      set({
        contextUsage: {
          filled_tokens: data.filled_tokens,
          total_tokens: data.total_tokens || 128000,
          remaining_tokens: data.remaining_tokens || 0,
          percent_used: data.percent_used || 0,
          compact_at_tokens: data.compact_at_tokens,
          model_limit: data.model_limit,
        },
      })
    }
  }

  const onAgentUsage = (raw: unknown) => {
    const data = raw as {
      usage?: {
        context_tokens?: number
        context_window?: number
        context_percent?: number
        compact_at_tokens?: number
        model_limit?: number
      }
      context_tokens?: number
      context_window?: number
      context_percent?: number
      compact_at_tokens?: number
      model_limit?: number
    }
    const usage = data?.usage || data
    if (usage && typeof usage.context_tokens === "number") {
      const win = usage.context_window || 128000
      set({
        contextUsage: {
          filled_tokens: usage.context_tokens,
          total_tokens: win,
          remaining_tokens: Math.max(0, win - usage.context_tokens),
          percent_used:
            usage.context_percent ??
            Number(((usage.context_tokens / win) * 100).toFixed(2)),
          compact_at_tokens: usage.compact_at_tokens,
          model_limit: usage.model_limit,
        },
      })
    }
  }

  const unsubs = [
    ws.subscribe("session:create", onSessionCreate),
    ws.subscribe("agent:busy", onBusy),
    ws.subscribe("error", onError),
    ws.subscribe("github:sync", onGithubSync),
    ws.subscribe("agent:budget_exceeded", onBudgetExceeded),
    ws.subscribe("agent:budget_warning", onBudgetWarning),
    ws.subscribe("agent:context_usage", onContextUsage),
    ws.subscribe("agent:usage", onAgentUsage),
  ]
  controlEventUnsubscribe = () => {
    unsubs.forEach((u) => u())
  }
}

function applySandboxEvent(
  type: string,
  data: SandboxWsPayload,
  get: () => WorkspaceState,
  set: (
    partial:
      | Partial<WorkspaceState>
      | ((state: WorkspaceState) => Partial<WorkspaceState>)
  ) => void
) {
  if (sandboxReadyTimer) {
    clearTimeout(sandboxReadyTimer)
    sandboxReadyTimer = null
  }

  const normalized = type.startsWith("sandbox:") ? type.slice(8) : type

  // 1. Success / Ready / Started
  if (normalized === "start" || normalized === "ready") {
    const sandboxId = data.sandbox_id ?? get().sandbox.sandboxId
    const previewUrl = data.preview_url ?? get().sandbox.previewUrl
    const backendUrl = data.backend_url ?? get().sandbox.backendUrl
    const frontendPort = data.frontend_port ?? get().sandbox.frontendPort
    const backendPort = data.backend_port ?? get().sandbox.backendPort

    set((state) => ({
      sandbox: {
        ...state.sandbox,
        active: true,
        status: "ready",
        title: data.title ?? "Sandbox Ready",
        message: data.message ?? "Development environment online",
        stage: "ready",
        error: null,
        sandboxId,
        previewUrl,
        backendUrl,
        frontendPort,
        backendPort,
      },
      ...(previewUrl
        ? {
            runSession: {
              ...state.runSession,
              status: "running",
              url: previewUrl,
            },
          }
        : {}),
    }))

    sandboxReadyTimer = setTimeout(() => {
      set((state) => ({
        sandbox: {
          ...state.sandbox,
          active: false,
        },
      }))
    }, 900)
    return
  }

  // 2. Error / Failed
  if (normalized === "error" || normalized === "failed") {
    const errMsg = data.error ?? data.message ?? "Sandbox failed to start"
    set((state) => ({
      sandbox: {
        ...state.sandbox,
        active: true,
        status: "error",
        title: data.title ?? "Sandbox Initialization Failed",
        message: errMsg,
        details: data.details,
        error: errMsg,
      },
    }))
    return
  }

  // 3. Resuming
  if (normalized === "resuming") {
    set((state) => ({
      sandbox: {
        ...state.sandbox,
        active: true,
        status: "resuming",
        title: data.title ?? "Resuming Sandbox",
        message: data.message ?? "Resuming paused container runtime...",
        stage: data.stage ?? "container",
        error: null,
      },
    }))
    return
  }

  // 4. Provisioning / Starting / Creating
  if (
    normalized === "provisioning" ||
    normalized === "starting" ||
    normalized === "initializing"
  ) {
    set((state) => ({
      sandbox: {
        ...state.sandbox,
        active: true,
        status: normalized === "provisioning" ? "provisioning" : "starting",
        title:
          data.title ??
          (normalized === "provisioning"
            ? "Provisioning Sandbox"
            : "Starting Sandbox"),
        message: data.message ?? "Setting up isolated container runtime...",
        stage: data.stage ?? "container",
        error: null,
      },
    }))
    return
  }

  // 5. Status / Progress updates
  if (
    normalized === "status" ||
    normalized === "stage" ||
    normalized === "event"
  ) {
    set((state) => ({
      sandbox: {
        ...state.sandbox,
        active: true,
        status:
          state.sandbox.status === "idle" ? "starting" : state.sandbox.status,
        title: data.title ?? state.sandbox.title ?? "Starting Sandbox",
        message: data.message ?? state.sandbox.message,
        stage: data.stage ?? state.sandbox.stage,
        details: data.details ?? state.sandbox.details,
      },
    }))
    return
  }

  // 6. Generic sandbox:* fallback
  set((state) => ({
    sandbox: {
      ...state.sandbox,
      active: true,
      title: data.title ?? state.sandbox.title ?? "Sandbox Activity",
      message:
        data.message ??
        (typeof data === "string" ? data : state.sandbox.message),
      stage: data.stage ?? state.sandbox.stage,
    },
  }))
}

function ensureSandboxListener(
  ws: ReturnType<typeof get_wehsocket>,
  get: () => WorkspaceState,
  set: (
    partial:
      | Partial<WorkspaceState>
      | ((state: WorkspaceState) => Partial<WorkspaceState>)
  ) => void
) {
  if (sandboxUnsubscribe) return

  sandboxUnsubscribe = ws.subscribe("sandbox:*", (raw) => {
    const event = raw as { type: string; data: SandboxWsPayload }
    if (!event || !event.type) return
    applySandboxEvent(event.type, event.data ?? {}, get, set)
  })
}

async function connectChatSocket(
  workspaceId: string,
  sessionId: string | null,
  get: () => WorkspaceState,
  set: (
    partial:
      | Partial<WorkspaceState>
      | ((state: WorkspaceState) => Partial<WorkspaceState>)
  ) => void
) {
  // Singleton is keyed by workspace_id only; session is sent on messages.
  const ws = get_wehsocket({
    workspace_id: workspaceId,
    session_id: sessionId,
  })
  await ws.connect()
  ensureAgentStreamListener(ws, get, set)
  ensureControlEventListener(ws, get, set)
  ensureSandboxListener(ws, get, set)
  return ws
}

function teardownWorkspaceConnection() {
  clearAgentStreamListener()
  clearSandboxListener()
  reset_websocket()
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspace: null,
  activeSessionId: null,
  pendingNewSession: false,
  files: [],
  openFileIds: [],
  activeFileId: null,
  terminalLines: [],
  chatMessages: [],
  runSession: {
    id: "run_idle",
    status: "idle",
    url: null,
    startedAt: null,
  },
  sandbox: {
    active: false,
    status: "idle",
    title: "",
    message: "",
    error: null,
    sandboxId: null,
    previewUrl: null,
    backendUrl: null,
    frontendPort: null,
    backendPort: null,
  },
  setSandboxState: (patch) =>
    set((state) => ({ sandbox: { ...state.sandbox, ...patch } })),
  dismissSandbox: () => {
    if (sandboxReadyTimer) {
      clearTimeout(sandboxReadyTimer)
      sandboxReadyTimer = null
    }
    set((state) => ({
      sandbox: {
        ...state.sandbox,
        active: false,
      },
    }))
  },
  contextUsage: null,
  selectedModel:
    typeof window !== "undefined"
      ? localStorage.getItem("ca_selected_model") || "gpt-5.6-luna"
      : "gpt-5.6-luna",
  selectedEffort:
    typeof window !== "undefined"
      ? (localStorage.getItem("ca_selected_effort") as ReasoningEffort) ||
        "high"
      : "high",
  setSelectedModel: (model: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ca_selected_model", model)
    }
    set({ selectedModel: model })
    const { activeSessionId, contextUsage } = get()
    if (activeSessionId && contextUsage) {
      void getSessionDetail(activeSessionId, model)
        .then((detail) => {
          if (detail.context_usage) {
            set({ contextUsage: detail.context_usage })
          }
        })
        .catch(() => {})
    }
  },
  setSelectedEffort: (effort: ReasoningEffort) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ca_selected_effort", effort)
    }
    set({ selectedEffort: effort })
  },
  teardownConnection: () => {
    teardownWorkspaceConnection()
  },

  retrySandbox: async () => {
    const { workspace, activeSessionId } = get()
    if (!workspace || !workspace.id) return
    set((state) => ({
      sandbox: {
        ...state.sandbox,
        active: true,
        status: "starting",
        title: "Reconnecting Sandbox",
        message: "Attempting to reconnect and start sandbox container...",
        error: null,
      },
    }))
    try {
      const ws = await connectChatSocket(
        workspace.id,
        activeSessionId,
        get,
        set
      )
      ws.send("agent:start", {
        workspace_id: workspace.id,
        session_id: activeSessionId,
      })
    } catch (err) {
      set((state) => ({
        sandbox: {
          ...state.sandbox,
          status: "error",
          title: "Retry Failed",
          message: err instanceof Error ? err.message : "Failed to reconnect",
          error: err instanceof Error ? err.message : "Failed to reconnect",
        },
      }))
    }
  },
  loading: false,
  chatLoading: false,
  streamingMessageId: null,
  workspaceTab: "preview",
  bottomPanel: "console",
  chatCollapsed: false,
  previewKey: 0,
  error: null,

  getActiveFile: () => {
    const { files, activeFileId } = get()
    if (!activeFileId) return null
    return flattenFiles(files).find((f) => f.id === activeFileId) ?? null
  },

  loadWorkspace: async (workspaceId, sessionId = null, options) => {
    const previousWorkspaceId = get().workspace?.id ?? null
    const previousSessionId = get().activeSessionId
    const startFresh = options?.startFresh === true

    // Abort in-flight agent when switching session / starting fresh on same WS
    if (
      previousWorkspaceId === workspaceId &&
      (startFresh ||
        (sessionId != null &&
          previousSessionId != null &&
          sessionId !== previousSessionId))
    ) {
      try {
        const existing = get_wehsocket({
          workspace_id: workspaceId,
          session_id: previousSessionId,
        })
        if (existing.isOpen) {
          existing.send("agent:abort", { query: "abort" })
        }
      } catch {
        // not connected yet
      }
    }

    // Switching workspaces: drop the old socket so it cannot reconnect.
    if (previousWorkspaceId && previousWorkspaceId !== workspaceId) {
      teardownWorkspaceConnection()
    } else {
      clearAgentStreamListener()
      clearSandboxListener()
    }
    resetChatBusyState(set)
    set({ loading: true, error: null })
    try {
      const [workspaceDetail, files, terminalLines] = await Promise.all([
        getWorkspace(workspaceId),
        getFileTree(workspaceId),
        getTerminalBoot(),
      ])
      const flat = flattenFiles(files)
      const firstFile = flat[0]
      // Fresh chat: do not fall back to an old session in the sidebar list
      const resolvedSessionId = startFresh
        ? null
        : (sessionId ?? workspaceDetail.sessions[0]?.id ?? null)

      let chatMessages: ThreadMessage[] = []
      let initialContextUsage: WorkspaceState["contextUsage"] = null
      if (resolvedSessionId) {
        try {
          const detail = await getSessionDetail(
            resolvedSessionId,
            get().selectedModel
          )
          chatMessages = messagesToThread(detail.messages, detail.session)
          if (detail.context_usage) {
            initialContextUsage = detail.context_usage
          }
        } catch {
          chatMessages = []
        }
      }

      set({
        workspace: workspaceDetail,
        activeSessionId: resolvedSessionId,
        pendingNewSession: startFresh,
        files,
        terminalLines,
        chatMessages,
        contextUsage: initialContextUsage,
        openFileIds: firstFile ? [firstFile.id] : [],
        activeFileId: firstFile?.id ?? null,
        loading: false,
        chatLoading: false,
        streamingMessageId: null,
        workspaceTab: "preview",
        runSession: {
          id: "run_idle",
          status: "idle",
          url: null,
          startedAt: null,
        },
      })

      const ws = await connectChatSocket(
        workspaceId,
        resolvedSessionId,
        get,
        set
      )
      if (workspaceDetail.status === "pending" && !resolvedSessionId) {
        ws.sendAgentStart({
          workspace_id: workspaceId,
          session_id: resolvedSessionId,
        })
      }
    } catch (error) {
      set({
        loading: false,
        error:
          error instanceof Error ? error.message : "Failed to load workspace",
      })
    }
  },

  openFile: (fileId) => {
    set((state) => ({
      openFileIds: state.openFileIds.includes(fileId)
        ? state.openFileIds
        : [...state.openFileIds, fileId],
      activeFileId: fileId,
      workspaceTab: "code",
    }))
  },

  closeFile: (fileId) => {
    set((state) => {
      const openFileIds = state.openFileIds.filter((id) => id !== fileId)
      const activeFileId =
        state.activeFileId === fileId
          ? (openFileIds[openFileIds.length - 1] ?? null)
          : state.activeFileId
      return { openFileIds, activeFileId }
    })
  },

  setActiveFile: (fileId) => set({ activeFileId: fileId }),

  updateActiveContent: (content) => {
    const { activeFileId, files } = get()
    if (!activeFileId) return
    set({ files: updateFileContent(files, activeFileId, content) })
  },

  executeCommand: async (command) => {
    if (command.trim() === "clear") {
      set({ terminalLines: [] })
      return
    }
    const lines = await runCommand(command)
    set((state) => ({
      terminalLines: [...state.terminalLines, ...lines],
    }))
  },
  startRun: async () => {
    const workspace = get().workspace
    if (!workspace) return

    set({
      runSession: {
        id: `run_${crypto.randomUUID().slice(0, 6)}`,
        status: "starting",
        url: null,
        startedAt: new Date().toISOString(),
      },
      workspaceTab: "preview",
    })

    try {
      // Trigger execution via WebSocket or API

      // If backend assigned workspace.frontend_port:
      const port = workspace.frontend_port || 32591
      const wildcardUrl = getPreviewUrl(workspace.id!, port)

      set({
        runSession: {
          id: get().runSession.id,
          status: "running",
          url: workspace.preview_url || wildcardUrl,
          startedAt: get().runSession.startedAt,
        },
      })
    } catch (error) {
      console.error("Failed to start preview:", error)
      set({
        runSession: {
          id: get().runSession.id,
          status: "error",
          url: null,
          startedAt: get().runSession.startedAt,
        },
      })
      throw error
    }
  },

  stopRun: () => {
    set((state) => ({
      runSession: {
        ...state.runSession,
        status: "stopped",
      },
      terminalLines: [
        ...state.terminalLines,
        {
          id: crypto.randomUUID(),
          type: "info",
          text: "Process stopped",
          timestamp: new Date().toISOString(),
        },
      ],
    }))
  },

  sendChat: async (prompt, attachments = []) => {
    const trimmed = prompt.trim()
    if (!trimmed && attachments.length === 0) return
    if (get().chatLoading || get().streamingMessageId) return

    const workspace = get().workspace
    if (!workspace?.id) {
      set({ error: "Workspace is not loaded" })
      return
    }

    chatAbortController?.abort()
    activeAgentStream = null

    const controller = new AbortController()
    chatAbortController = controller

    const sessionId = get().activeSessionId
    const pendingNew = get().pendingNewSession
    // Fresh "New Session" may have no id yet — pi_sdk new_session creates it.
    if (!sessionId && !pendingNew) {
      set({ error: "No active session. Create or select a session first." })
      return
    }
    let streamAssistantId = ""

    controller.signal.addEventListener(
      "abort",
      () => {
        activeAgentStream = null
        const stoppedId = streamAssistantId
        set((state) => ({
          chatLoading: false,
          streamingMessageId: null,
          chatMessages: state.chatMessages.map((msg) =>
            msg.id === stoppedId
              ? {
                  ...msg,
                  content: msg.content || "Generation stopped.",
                }
              : msg
          ),
        }))
      },
      { once: true }
    )

    try {
      const ws = await connectChatSocket(
        workspace.id,
        get().activeSessionId,
        get,
        set
      )

      streamAssistantId = beginAgentStream(get, set, {
        sessionId: sessionId ?? "pending",
        userContent: trimmed || "(attached files)",
        attachments,
      })

      const { selectedModel, selectedEffort } = get()
      // Omit session_id for pending new sessions so chat_ws uses new_session()
      ws.sendAgentQuery(
        trimmed || "Review my attachments",
        pendingNew ? null : sessionId,
        {
          model: selectedModel,
          reasoning_effort: selectedEffort,
        }
      )
    } catch (error) {
      activeAgentStream = null
      set({
        chatLoading: false,
        streamingMessageId: null,
        error:
          error instanceof Error ? error.message : "Failed to send message",
      })
    }
  },

  stopStreaming: async () => {
    const workspace = get().workspace
    if (!workspace?.id) {
      set({ error: "Workspace is not loaded" })
      return
    }
    const ws = await connectChatSocket(
      workspace.id,
      get().activeSessionId,
      get,
      set
    )
    ws.send("agent:abort", { query: "abort" })
    chatAbortController?.abort()
    chatAbortController = null
  },

  setWorkspaceTab: (tab) => set({ workspaceTab: tab }),
  setBottomPanel: (panel) => set({ bottomPanel: panel }),
  setChatCollapsed: (collapsed) => set({ chatCollapsed: collapsed }),
  toggleChatCollapsed: () =>
    set((state) => ({ chatCollapsed: !state.chatCollapsed })),
  reloadPreview: () => set((state) => ({ previewKey: state.previewKey + 1 })),
}))

if (typeof window !== "undefined") {
  ;(window as unknown as Record<string, unknown>).__cloudAgentTestSandbox = (
    status: SandboxStatus = "starting",
    message = "Setting up your development environment..."
  ) => {
    useWorkspaceStore.getState().setSandboxState({
      active: true,
      status,
      title:
        status === "error"
          ? "Sandbox failed to start"
          : status === "ready"
            ? "Sandbox Ready"
            : status === "provisioning"
              ? "Provisioning environment"
              : status === "resuming"
                ? "Resuming Sandbox"
                : "Starting Sandbox Runtime",
      message,
      stage:
        status === "provisioning"
          ? "network"
          : status === "ready"
            ? "ready"
            : "container",
      error:
        status === "error"
          ? "Something went wrong while starting the sandbox. Please try again."
          : null,
    })
  }
}
