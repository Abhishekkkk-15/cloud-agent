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
import { useAuthStore } from "@/stores/auth-store"
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
  const user = useAuthStore((s) => s.user)
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
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <SparklesIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Agent</span>
        {activeFileName && (
          <span className="truncate text-xs text-muted-foreground">
            · editing {activeFileName}
          </span>
        )}
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
                        {!isAgentTurn ? (
                          <MessageAvatar>
                            <Avatar className="size-8">
                              <AvatarFallback>
                                {isUser ? (user?.name?.[0] ?? "U") : "A"}
                              </AvatarFallback>
                            </Avatar>
                          </MessageAvatar>
                        ) : null}
                        <MessageContent
                          className={cn(isAgentTurn && "gap-0 pl-1")}
                        >
                          {!isAgentTurn ? (
                            <MessageHeader>
                              {isUser ? (user?.name ?? "You") : "Cloud Agent"}
                            </MessageHeader>
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

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit(prompt)
        }}
        className={cn(
          "flex flex-col gap-2 border-t p-3",
          dragging && "bg-muted/40"
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
          <ChatAttachmentList
            attachments={attachments}
            onRemove={removeAttachment}
          />
        )}
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask the agent to build, fix, or explain… (drop files here)"
          rows={3}
          className="resize-none"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void submit(prompt)
            }
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
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
              variant="outline"
              size="sm"
              disabled={busy || attachments.length >= MAX_FILES}
              onClick={() => fileInputRef.current?.click()}
            >
              <PaperclipIcon data-icon="inline-start" />
              Attach
            </Button>
            <p className="text-xs text-muted-foreground">
              Enter to send · max {MAX_FILES} files / 5MB
            </p>
          </div>
          <div className="flex items-center gap-2">
            {busy ? (
              <Button
                type="button"
                variant="destructive"
                onClick={stopStreaming}
              >
                <SquareIcon data-icon="inline-start" />
                Stop
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!prompt.trim() && attachments.length === 0}
              >
                <SendIcon data-icon="inline-start" />
                Send
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
