import { create } from "zustand"

import {
  getChatSeed,
  getFileTree,
  getTerminalBoot,
  getWorkspace,
  runCommand,
} from "@/lib/api"
import { get_wehsocket } from "@/lib/websocket"
import {
  isTerminalAgentEvent,
  wsEventToUiEvent,
  wsPayloadText,
  type AgentWsEventPayload,
} from "@/types/agent-ws-events"
import type { ChatAttachment, ThreadMessage } from "@/types/chat-ui"
import type {
  FileNode,
  RunSession,
  TerminalLine,
  Workspace,
} from "@cloud-agent/shared"

function flattenFiles(nodes: FileNode[], acc: FileNode[] = []): FileNode[] {
  for (const node of nodes) {
    if (node.type === "file") acc.push(node)
    if (node.children) flattenFiles(node.children, acc)
  }
  return acc
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
    sessionId?: string | null
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
}

let chatAbortController: AbortController | null = null
let agentStreamUnsubscribe: (() => void) | null = null

type ActiveAgentStream = {
  assistantId: string
  textBuffer: string
}

let activeAgentStream: ActiveAgentStream | null = null

function clearAgentStreamListener() {
  agentStreamUnsubscribe?.()
  agentStreamUnsubscribe = null
  activeAgentStream = null
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

  if (payload.type === "text_delta" || payload.type === "text") {
    const chunk = wsPayloadText(payload) ?? ""
    if (chunk) textBuffer += chunk
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
            events: [...(msg.events ?? []), uiEvent],
          }
        : msg
    ),
    ...(payload.session_id ? { activeSessionId: payload.session_id } : {}),
  }))

  if (isTerminalAgentEvent(payload)) {
    activeAgentStream = null
    set({ chatLoading: false, streamingMessageId: null })
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
  const ws = get_wehsocket({
    workspace_id: workspaceId,
    session_id: sessionId,
  })
  await ws.connect()
  ensureAgentStreamListener(ws, get, set)
  return ws
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspace: null,
  activeSessionId: null,
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
  loading: false,
  chatLoading: false,
  streamingMessageId: null,
  workspaceTab: "preview",
  bottomPanel: "console",
  error: null,

  getActiveFile: () => {
    const { files, activeFileId } = get()
    if (!activeFileId) return null
    return flattenFiles(files).find((f) => f.id === activeFileId) ?? null
  },

  loadWorkspace: async (workspaceId, sessionId = null) => {
    clearAgentStreamListener()
    set({ loading: true, error: null })
    try {
      const [workspaceDetail, files, terminalLines, chatSeed] =
        await Promise.all([
          getWorkspace(workspaceId),
          getFileTree(workspaceId),
          getTerminalBoot(),
          getChatSeed(),
        ])
      const flat = flattenFiles(files)
      const firstFile = flat[0]
      const seedKey = `agent-seed:${workspaceId}`
      const seed = sessionStorage.getItem(seedKey)
      const resolvedSessionId =
        sessionId ?? workspaceDetail.sessions[0]?.id ?? `${workspaceId}_main`

      let chatMessages = chatSeed.map((message) => ({
        ...message,
        session_id: resolvedSessionId,
      }))
      if (seed) {
        sessionStorage.removeItem(seedKey)
        chatMessages = [
          {
            id: crypto.randomUUID(),
            session_id: resolvedSessionId,
            seq: 0,
            role: "user",
            content: seed,
          },
          {
            id: crypto.randomUUID(),
            session_id: resolvedSessionId,
            seq: 1,
            role: "assistant",
            content: `Got it — I'll scaffold “${workspaceDetail.title}” around:\n\n> ${seed}\n\nI set up a starter workspace. Open the Code tab to edit files, or hit Run to preview. What should we tackle first?`,
          },
        ]
      }

      set({
        workspace: workspaceDetail,
        activeSessionId: resolvedSessionId,
        files,
        terminalLines,
        chatMessages,
        openFileIds: firstFile ? [firstFile.id] : [],
        activeFileId: firstFile?.id ?? null,
        loading: false,
        workspaceTab: "preview",
        runSession: {
          id: "run_idle",
          status: "idle",
          url: null,
          startedAt: null,
        },
      })

      if (!seed) {
        const ws = await connectChatSocket(
          workspaceId,
          resolvedSessionId,
          get,
          set
        )
        if (workspaceDetail.status === "pending") {
          ws.sendAgentStart({
            workspace_id: workspaceId,
            session_id: resolvedSessionId,
          })
        }
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
    set({
      runSession: {
        id: `run_${crypto.randomUUID().slice(0, 6)}`,
        status: "starting",
        url: null,
        startedAt: new Date().toISOString(),
      },
      workspaceTab: "preview",
    })
    await get().executeCommand("npm run dev")
    const workspace = get().workspace
    set({
      runSession: {
        id: get().runSession.id,
        status: "running",
        url: `https://${workspace?.title ?? "app"}.cloudagent.dev`,
        startedAt: get().runSession.startedAt,
      },
    })
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

    const sessionId = get().activeSessionId ?? `${workspace.id}_main`
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
        sessionId,
        userContent: trimmed || "(attached files)",
        attachments,
      })

      ws.sendAgentQuery(trimmed || "Review my attachments")
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

  stopStreaming: () => {
    chatAbortController?.abort()
    chatAbortController = null
  },

  setWorkspaceTab: (tab) => set({ workspaceTab: tab }),
  setBottomPanel: (panel) => set({ bottomPanel: panel }),
}))
