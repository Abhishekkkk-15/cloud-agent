import { useEffect, useRef, useState } from "react"
import {
  PaperclipIcon,
  SendIcon,
  SparklesIcon,
  SquareIcon,
} from "lucide-react"
import { toast } from "sonner"

import { AgentEventTurn } from "@/components/workspace/AgentEventTurn"
import { ChatAttachmentList } from "@/components/workspace/ChatAttachmentList"
import { ChatMarkdown } from "@/components/workspace/ChatMarkdown"
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

const suggestions = [
  "Explain what this workspace does",
  "Add a dark mode toggle",
  "Fix any TypeScript errors",
  "Improve the landing page copy",
]

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
  const activeFileName = useWorkspaceStore((s) => s.getActiveFile()?.name)
  const [prompt, setPrompt] = useState("")
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const busy = chatLoading || !!streamingMessageId

  useEffect(() => {
    return () => revokeAttachmentUrls(attachments)
    // Only revoke on unmount for current composer attachments
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList)
    if (incoming.length === 0) return

    setAttachments((prev) => {
      const next = [...prev]
      for (const file of incoming) {
        if (next.length >= MAX_FILES) {
          toast.error(`Max ${MAX_FILES} attachments`)
          break
        }
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name} is larger than 5MB`)
          continue
        }
        const kind = file.type.startsWith("image/") ? "image" : "file"
        next.push({
          id: crypto.randomUUID(),
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          kind,
          previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
        })
      }
      return next
    })
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
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b px-3">
        <div className="flex min-w-0 items-center gap-2">
          <SparklesIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-medium">Agent</span>
          {activeFileName && (
            <span className="truncate text-xs text-muted-foreground">
              · editing {activeFileName}
            </span>
          )}
        </div>
        <ModelAndEffortSelector compact disabled={busy} />
      </div>

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
                          {isAgentTurn ? (
                            <AgentEventTurn
                              events={message.events}
                              activities={message.activities}
                              summary={message.content}
                              streaming={isStreaming}
                              defaultOpen={isStreaming}
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
                                    {message.content || (isStreaming ? " " : "")}
                                  </span>
                                ) : (
                                  <ChatMarkdown
                                    content={message.content}
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

      {messages.length === 0 && !busy && (
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
      )}

      <div className="border-t p-3 bg-background">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit(prompt)
          }}
          className={cn(
            "relative flex flex-col rounded-xl border border-border/80 bg-muted/20 dark:bg-muted/10 p-2 shadow-xs transition-colors focus-within:border-ring/80 focus-within:ring-2 focus-within:ring-ring/20",
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
          {attachments.length > 0 && (
            <div className="mb-2">
              <ChatAttachmentList
                attachments={attachments}
                onRemove={removeAttachment}
              />
            </div>
          )}
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Plan, Build, / for skills, @ for context"
            rows={2}
            className="min-h-[48px] max-h-44 w-full resize-none border-0 bg-transparent p-1.5 text-sm shadow-none outline-none focus-visible:ring-0 placeholder:text-muted-foreground/60 dark:placeholder:text-muted-foreground/50"
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void submit(prompt)
              }
            }}
          />
          <div className="flex items-center justify-between gap-2 pt-1">
            {/* Left: Model & Effort hover selector */}
            <div className="flex items-center gap-1">
              <ModelAndEffortSelector disabled={busy} />
            </div>

            {/* Right: Attach & Send/Stop action buttons */}
            <div className="flex items-center gap-1">
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
                className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70"
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
                      ? "opacity-30 cursor-not-allowed"
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
