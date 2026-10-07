import { useEffect, useRef, useState } from "react"
import {
  HammerIcon,
  ListTodoIcon,
  PaperclipIcon,
  SendIcon,
  SquareIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AgentEventTurn } from "@/components/workspace/AgentEventTurn"
import { AskUserCard } from "@/components/workspace/AskUserCard"
import { ChatAttachmentList } from "@/components/workspace/ChatAttachmentList"
import { ChatMarkdown } from "@/components/workspace/ChatMarkdown"
import { ContextUsageIndicator } from "@/components/workspace/ContextUsageIndicator"
import {
  ExecutionPlanCard,
  hasPlanBlock,
  stripPlanFromMarkdown,
} from "@/components/workspace/ExecutionPlanCard"
import {
  SlashCommandMenu,
  SLASH_COMMANDS,
  type SlashCommandItem,
} from "@/components/workspace/SlashCommandMenu"
import { ModelAndEffortSelector } from "@/components/workspace/ModelAndEffortSelector"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Textarea } from "@/components/ui/textarea"
import { useWorkspaceStore } from "@/stores/workspace-store"
import type { ChatAttachment } from "@/types/chat-ui"
import { cn } from "@/lib/utils"

const MAX_FILES = 5
const MAX_BYTES = 5 * 1024 * 1024

function revokeAttachmentUrls(items: ChatAttachment[]) {
  for (const item of items) {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  }
}

export function AiChatPanel() {
  const messages = useWorkspaceStore((s) => s.chatMessages)
  const chatLoading = useWorkspaceStore((s) => s.chatLoading)
  const streamingMessageId = useWorkspaceStore((s) => s.streamingMessageId)
  const sendChat = useWorkspaceStore((s) => s.sendChat)
  const stopStreaming = useWorkspaceStore((s) => s.stopStreaming)
  const submitUserAnswer = useWorkspaceStore((s) => s.submitUserAnswer)
  const chatMode = useWorkspaceStore((s) => s.chatMode)
  const setChatMode = useWorkspaceStore((s) => s.setChatMode)
  const [prompt, setPrompt] = useState("")
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const busy = chatLoading || !!streamingMessageId

  const isSlashCommandOpen =
    prompt.startsWith("/") &&
    !prompt.includes(" ") &&
    !prompt.includes("\n")

  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0)

  const cleanSlashQuery = prompt.startsWith("/")
    ? prompt.slice(1).toLowerCase().trim()
    : prompt.toLowerCase().trim()

  const matchingSlashCommands = SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(cleanSlashQuery) ||
      cmd.title.toLowerCase().includes(cleanSlashQuery) ||
      cmd.id.toLowerCase().includes(cleanSlashQuery)
  )

  useEffect(() => {
    setSelectedSlashIndex(0)
  }, [cleanSlashQuery])

  const handleSelectSlashCommand = (cmd: SlashCommandItem) => {
    if (cmd.id === "plan") {
      setChatMode("plan")
      setPrompt("")
      toast.success("Switched to Plan Mode (Read-only)")
    } else if (cmd.id === "build") {
      setChatMode("build")
      setPrompt("")
      toast.success("Switched to Build Mode")
    } else if (cmd.id === "fix") {
      setPrompt("/fix ")
    } else if (cmd.id === "review") {
      setPrompt("/review ")
    }
  }

  useEffect(() => {
    return () => revokeAttachmentUrls(attachments)
    // Only revoke on unmount for current composer attachments
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const res = reader.result as string
        // Strip data:mime/type;base64, prefix to store raw base64
        const commaIdx = res.indexOf(",")
        resolve(commaIdx !== -1 ? res.slice(commaIdx + 1) : res)
      }
      reader.onerror = (err) => reject(err)
      reader.readAsDataURL(file)
    })
  }

  async function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList)
    if (incoming.length === 0) return

    for (const file of incoming) {
      if (attachments.length >= MAX_FILES) {
        toast.error(`Max ${MAX_FILES} attachments`)
        break
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is larger than 5MB`)
        continue
      }
      const kind = file.type.startsWith("image/") ? "image" : "file"
      let dataBase64: string | undefined = undefined
      if (kind === "image") {
        try {
          dataBase64 = await readFileAsBase64(file)
        } catch {
          toast.error(`Failed to read ${file.name}`)
          continue
        }
      }

      setAttachments((prev) => {
        if (prev.length >= MAX_FILES) return prev
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            kind,
            previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
            data_base64: dataBase64,
            dataBase64: dataBase64,
          },
        ]
      })
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((item) => item.id !== id)
    })
  }

  async function submit(value: string) {
    const trimmed = value.trim()
    if ((!trimmed && attachments.length === 0) || busy) return
    const payload = attachments
    setPrompt("")
    setAttachments([])
    await sendChat(trimmed, payload)
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-r bg-background">
      <div className="min-h-0 flex-1">
        <MessageScrollerProvider autoScroll>
          <MessageScroller>
            <MessageScrollerViewport>
              <MessageScrollerContent className="gap-4 p-4">
                {messages.map((message) => {
                  const isUser = message.role === "user"
                  const hasEvents =
                    !!message.events && message.events.length > 0
                  const hasActivities =
                    !!message.activities && message.activities.length > 0
                  const isStreaming = message.id === streamingMessageId
                  const isAgentTurn = !isUser && (hasEvents || hasActivities)
                  const showBubble =
                    isUser ||
                    (!isAgentTurn &&
                      (message.content.length > 0 || isStreaming))

                  const activePlan = !isUser
                    ? message.planContent || (hasPlanBlock(message.content) ? message.content : undefined)
                    : undefined

                  return (
                    <MessageScrollerItem
                      key={message.id}
                      messageId={message.id}
                      scrollAnchor={isUser}
                    >
                      <Message align={isUser ? "end" : "start"}>
                        {!isUser && !isAgentTurn ? (
                          <MessageAvatar>
                            <Avatar className="size-8">
                              <AvatarFallback>A</AvatarFallback>
                            </Avatar>
                          </MessageAvatar>
                        ) : null}
                        <MessageContent
                          className={cn(isAgentTurn && "gap-0 pl-1")}
                        >
                          {!isUser && !isAgentTurn ? (
                            <MessageHeader>Cloud Agent</MessageHeader>
                          ) : null}
                          {isUser && message.attachments?.length ? (
                            <ChatAttachmentList
                              attachments={message.attachments}
                            />
                          ) : null}
                          {activePlan && (
                            <div className="mb-2 w-full max-w-2xl">
                              <ExecutionPlanCard
                                content={activePlan}
                                isStreaming={isStreaming}
                                mode={message.mode}
                                onExecutePlan={(planSummary) => {
                                  setChatMode("build")
                                  toast.info("Switching to Build Mode to execute plan")
                                  void sendChat(`Execute the plan:\n${planSummary}`)
                                }}
                              />
                            </div>
                          )}
                          {isAgentTurn ? (
                            <AgentEventTurn
                              events={message.events}
                              activities={message.activities}
                              summary={message.content}
                              streaming={isStreaming}
                              defaultOpen={isStreaming}
                            />
                          ) : null}
                          {message.askUser ? (
                            <AskUserCard
                              payload={message.askUser}
                              answered={message.askUserAnswered}
                              onSubmit={(answers) =>
                                void submitUserAnswer(
                                  message.askUser.request_id,
                                  answers
                                )
                              }
                            />
                          ) : null}
                          {showBubble && (
                            <Bubble
                              variant={isUser ? "default" : "muted"}
                              align={isUser ? "end" : "start"}
                            >
                              <BubbleContent>
                                {isUser ? (
                                  <span className="whitespace-pre-wrap">
                                    {message.content ||
                                      (isStreaming ? " " : "")}
                                  </span>
                                ) : (
                                  <ChatMarkdown
                                    content={stripPlanFromMarkdown(message.content)}
                                    streaming={isStreaming}
                                  />
                                )}
                              </BubbleContent>
                            </Bubble>
                          )}
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  )
                })}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      </div>

      {/* {messages.length === 0 && !busy && (
        <div className="flex flex-wrap gap-2 border-t px-3 py-2">
          {suggestions.map((item) => (
            <Button
              key={item}
              variant="outline"
              size="xs"
              onClick={() => void submit(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      )} */}

      <div className="border-t bg-background p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit(prompt)
          }}
          className={cn(
            "relative flex flex-col rounded-xl border border-border/80 bg-muted/20 p-2 shadow-xs transition-colors focus-within:border-ring/80 focus-within:ring-2 focus-within:ring-ring/20 dark:bg-muted/10",
            dragging && "border-primary/50 bg-muted/40"
          )}
          onDragEnter={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            if (e.currentTarget.contains(e.relatedTarget as Node)) return
            setDragging(false)
          }}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
          }}
        >
          {chatMode === "plan" && (
            <div className="mb-2 flex items-center justify-between rounded-md bg-sky-500/10 px-2.5 py-1 text-xs text-sky-700 dark:text-sky-300">
              <span className="flex items-center gap-1.5 font-medium">
                <ListTodoIcon className="size-3.5" />
                Plan Mode active — Read-only exploration & plan generation
              </span>
              <button
                type="button"
                onClick={() => setChatMode("build")}
                className="text-[11px] underline underline-offset-2 opacity-80 hover:opacity-100 cursor-pointer"
              >
                Switch to Build
              </button>
            </div>
          )}
          {attachments.length > 0 && (
            <div className="mb-2">
              <ChatAttachmentList
                attachments={attachments}
                onRemove={removeAttachment}
              />
            </div>
          )}
          {isSlashCommandOpen && (
            <SlashCommandMenu
              query={prompt}
              selectedIndex={selectedSlashIndex}
              onSelect={handleSelectSlashCommand}
            />
          )}
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              chatMode === "plan"
                ? "Plan Mode: Describe feature, bug or architecture to research and plan (/build to switch)..."
                : "Plan, Build, /plan for plan mode, @ for context"
            }
            rows={2}
            className="max-h-44 min-h-[48px] w-full resize-none border-0 bg-transparent p-1.5 text-sm shadow-none outline-none placeholder:text-muted-foreground/60 focus-visible:ring-0 dark:placeholder:text-muted-foreground/50"
            disabled={busy}
            onKeyDown={(e) => {
              if (isSlashCommandOpen && matchingSlashCommands.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault()
                  setSelectedSlashIndex((prev) => (prev + 1) % matchingSlashCommands.length)
                  return
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault()
                  setSelectedSlashIndex(
                    (prev) => (prev - 1 + matchingSlashCommands.length) % matchingSlashCommands.length
                  )
                  return
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault()
                  const selected = matchingSlashCommands[selectedSlashIndex]
                  if (selected) {
                    handleSelectSlashCommand(selected)
                  }
                  return
                }
                if (e.key === "Escape") {
                  e.preventDefault()
                  setPrompt("")
                  return
                }
              }

              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void submit(prompt)
              }
            }}
          />
          <div className="flex items-center justify-between gap-2 pt-1">
            {/* Left: Mode Toggle & Model/Effort hover selector */}
            <div className="flex items-center gap-1.5 overflow-hidden">
              <div className="flex items-center rounded-md border border-border/70 bg-background/80 p-0.5 text-[11px] font-medium shadow-2xs">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setChatMode("build")}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-0.5 transition-colors cursor-pointer",
                    chatMode === "build"
                      ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Build Mode: Agent can read and write files directly"
                >
                  <HammerIcon className="size-3" />
                  Build
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setChatMode("plan")}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-0.5 transition-colors cursor-pointer",
                    chatMode === "plan"
                      ? "bg-sky-600 text-white font-semibold shadow-2xs dark:bg-sky-500"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Plan Mode: Read-only codebase exploration & execution plan generation"
                >
                  <ListTodoIcon className="size-3" />
                  Plan
                </button>
              </div>

              <ModelAndEffortSelector disabled={busy} />
            </div>

            {/* Right: Context indicator, Attach & Send/Stop action buttons */}
            <div className="flex items-center gap-1">
              <ContextUsageIndicator />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files)
                  e.target.value = ""
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-7 rounded-md text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                disabled={busy || attachments.length >= MAX_FILES}
                onClick={() => fileInputRef.current?.click()}
                title="Attach files (max 5 files / 5MB)"
              >
                <PaperclipIcon className="size-4" />
              </Button>

              {busy ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-xs"
                  className="size-7 rounded-md"
                  onClick={stopStreaming}
                  title="Stop generation"
                >
                  <SquareIcon className="size-3" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon-xs"
                  className={cn(
                    "size-7 rounded-md transition-all",
                    !prompt.trim() && attachments.length === 0
                      ? "cursor-not-allowed opacity-30"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                  disabled={!prompt.trim() && attachments.length === 0}
                  title="Send message (Enter)"
                >
                  <SendIcon className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
