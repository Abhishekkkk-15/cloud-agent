import { create } from "zustand"

import { streamText } from "@/lib/mock-stream"
import {
  getChatSeed,
  getFileTree,
  getTerminalBoot,
  getWorkspace,
  runCommand,
  sendChatMessage,
} from "@/lib/api"
import type {
  AgentActivity,
  ChatAttachment,
  ThreadMessage,
} from "@/types/chat-ui"
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
  loadWorkspace: (workspaceId: string, sessionId?: string | null) => Promise<void>
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

    chatAbortController?.abort()
    const controller = new AbortController()
    chatAbortController = controller

    let assistantId: string | null = null
    const sessionId = get().activeSessionId ?? "sess_local"
    const nextSeq = get().chatMessages.length

    const userMessage: ThreadMessage = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      seq: nextSeq,
      role: "user",
      content: trimmed || "(attached files)",
      attachments: attachments.length ? attachments : undefined,
    }
    set((state) => ({
      chatMessages: [...state.chatMessages, userMessage],
      chatLoading: true,
    }))

    const finalizeAssistant = (contentFallback?: string) => {
      if (!assistantId) return
      const id = assistantId
      set((state) => ({
        chatLoading: false,
        streamingMessageId: null,
        chatMessages: state.chatMessages.map((msg) =>
          msg.id === id
            ? {
                ...msg,
                content: msg.content || contentFallback || msg.content,
                activities: msg.activities?.map((activity) => ({
                  ...activity,
                  status:
                    activity.status === "pending" ||
                    activity.status === "running"
                      ? ("done" as const)
                      : activity.status,
                })),
              }
            : msg
        ),
      }))
    }

    try {
      const active = get().getActiveFile()
      const { message, activities } = await sendChatMessage(
        trimmed || "Review my attachments",
        active ? { id: active.id, name: active.name } : null,
        attachments.length,
        sessionId
      )

      if (controller.signal.aborted) {
        set({ chatLoading: false })
        return
      }

      const pendingActivities = activities.map((activity, index) => ({
        ...activity,
        status: (index === 0 ? "running" : "pending") as AgentActivity["status"],
      }))

      assistantId = message.id
      set((state) => ({
        chatMessages: [
          ...state.chatMessages,
          {
            ...message,
            seq: nextSeq + 1,
            content: "",
            activities: pendingActivities,
          },
        ],
        streamingMessageId: assistantId,
      }))

      for (let i = 0; i < pendingActivities.length; i++) {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(() => resolve(), 400)
          const onAbort = () => {
            window.clearTimeout(timer)
            reject(new DOMException("Aborted", "AbortError"))
          }
          controller.signal.addEventListener("abort", onAbort, { once: true })
        })

        set((state) => ({
          chatMessages: state.chatMessages.map((msg) => {
            if (msg.id !== assistantId || !msg.activities) return msg
            return {
              ...msg,
              activities: msg.activities.map((activity, index) => {
                if (index <= i) return { ...activity, status: "done" as const }
                if (index === i + 1)
                  return { ...activity, status: "running" as const }
                return activity
              }),
            }
          }),
        }))
      }

      set((state) => ({
        chatMessages: state.chatMessages.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                activities: (msg.activities ?? []).map((activity) => ({
                  ...activity,
                  status: "done" as const,
                })),
              }
            : msg
        ),
        chatLoading: false,
      }))

      await streamText(message.content, {
        signal: controller.signal,
        delayMs: 16,
        chunkSize: 4,
        onChunk: (_chunk, fullText) => {
          set((state) => ({
            chatMessages: state.chatMessages.map((msg) =>
              msg.id === assistantId ? { ...msg, content: fullText } : msg
            ),
          }))
        },
      })

      set({ streamingMessageId: null })
    } catch (error) {
      const aborted =
        error instanceof DOMException && error.name === "AbortError"
      if (aborted) {
        finalizeAssistant("Generation stopped.")
      } else {
        set({ chatLoading: false, streamingMessageId: null })
      }
    } finally {
      if (chatAbortController === controller) {
        chatAbortController = null
      }
    }
  },

  stopStreaming: () => {
    chatAbortController?.abort()
  },

  setWorkspaceTab: (tab) => set({ workspaceTab: tab }),
  setBottomPanel: (panel) => set({ bottomPanel: panel }),
}))
