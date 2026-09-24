import { useEffect, useRef } from "react"
import {
  BotIcon,
  CheckCircle2Icon,
  Code2Icon,
  DownloadIcon,
  PlayIcon,
  SparklesIcon,
  TerminalIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChatComposer } from "@/components/chat/ChatComposer"
import { ChatMarkdown } from "@/components/chat/ChatMarkdown"
import { ThoughtTrace } from "@/components/chat/ThoughtTrace"
import { ToolCallCard } from "@/components/chat/ToolCallCard"
import { AskUserCard } from "@/components/chat/AskUserCard"
import { useAgentStore } from "@/stores/agent-store"

export function AiChatPanel() {
  const messages = useAgentStore((s) => s.messages)
  const isStreaming = useAgentStore((s) => s.isStreaming)
  const streamingThought = useAgentStore((s) => s.streamingThought)
  const approveTool = useAgentStore((s) => s.approveTool)
  const rejectTool = useAgentStore((s) => s.rejectTool)
  const clearMessages = useAgentStore((s) => s.clearMessages)
  const sendMessage = useAgentStore((s) => s.sendMessage)
  const activeSessionId = useAgentStore((s) => s.activeSessionId)
  const sessions = useAgentStore((s) => s.sessions)
  const activeAgentId = useAgentStore((s) => s.activeAgentId)
  const agents = useAgentStore((s) => s.agents)

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const activeAgent = agents.find((a) => a.id === activeAgentId)

  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isStreaming, streamingThought])

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-background">
      {/* Top Session Action Bar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-4 bg-card/40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-xs font-semibold text-foreground">
            {activeSession?.title || "Active Coding Session"}
          </span>
          {activeSession?.tokenUsage && (
            <Badge variant="outline" className="h-4.5 px-1.5 text-[10px] font-mono text-muted-foreground hidden sm:inline-flex">
              {activeSession.tokenUsage.total.toLocaleString()} tokens
            </Badge>
          )}
          {isStreaming && (
            <Badge variant="secondary" className="h-4.5 gap-1 px-1.5 text-[10px] text-amber-500 font-normal">
              <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
              <span>Agent Working</span>
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={clearMessages}
            title="Clear conversation"
          >
            <Trash2Icon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-7 text-muted-foreground hover:text-foreground"
            title="Export session transcript"
          >
            <DownloadIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Message Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Empty State */}
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner mb-4">
                <SparklesIcon className="size-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Control {activeAgent?.name || "your agent"} from one place
              </h3>
              <p className="mt-1 max-w-md text-xs text-muted-foreground leading-relaxed">
                Send instructions directly to your local CLI. Tool executions and host commands stream here via peer-to-peer WebRTC.
              </p>

              {/* Starter Suggestions */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                <button
                  type="button"
                  onClick={() => sendMessage("Inspect our recent git commits and check for uncommitted changes")}
                  className="flex items-start gap-2.5 rounded-xl border bg-card/60 p-3 text-left hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  <Code2Icon className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-medium text-foreground">Inspect Git Status</div>
                    <div className="text-[11px] text-muted-foreground">Check uncommitted files and diffs</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => sendMessage("Run our test suite and fix any broken TypeScript types")}
                  className="flex items-start gap-2.5 rounded-xl border bg-card/60 p-3 text-left hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  <TerminalIcon className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-medium text-foreground">Run Test Suite</div>
                    <div className="text-[11px] text-muted-foreground">Execute test runners on local host</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => sendMessage("Review security vulnerabilities and clean up unused packages in package.json")}
                  className="flex items-start gap-2.5 rounded-xl border bg-card/60 p-3 text-left hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  <CheckCircle2Icon className="size-4 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-medium text-foreground">Audit Dependencies</div>
                    <div className="text-[11px] text-muted-foreground">Identify outdated or insecure packages</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => sendMessage("Scaffold authentication router and verify JWT middleware")}
                  className="flex items-start gap-2.5 rounded-xl border bg-card/60 p-3 text-left hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  <PlayIcon className="size-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-medium text-foreground">Scaffold Feature</div>
                    <div className="text-[11px] text-muted-foreground">Generate complete files in 1 turn</div>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const isUser = message.role === "user"

              return (
                <div
                  key={message.id}
                  className={`flex gap-3 text-xs ${
                    isUser ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {/* Avatar */}
                  <Avatar className="size-7 shrink-0 border bg-muted">
                    <AvatarFallback className="text-[10px] font-medium">
                      {isUser ? <UserIcon className="size-3.5" /> : <BotIcon className="size-3.5 text-primary" />}
                    </AvatarFallback>
                  </Avatar>

                  {/* Message Bubble & Content Area */}
                  <div className={`flex max-w-[85%] flex-col ${isUser ? "items-end" : "items-start w-full"}`}>
                    {/* Role & Timestamp header */}
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="font-semibold">{isUser ? "You" : activeAgent?.name || "Agent"}</span>
                      <span>·</span>
                      <span>{message.timestamp}</span>
                    </div>

                    {/* Content Box */}
                    {isUser ? (
                      <div className="rounded-2xl bg-primary px-3.5 py-2.5 text-xs text-primary-foreground leading-relaxed shadow-sm">
                        {message.content}
                      </div>
                    ) : (
                      <div className="w-full space-y-2">
                        {/* Thinking Trace (Collapsible) */}
                        {message.thought && (
                          <ThoughtTrace
                            thought={message.thought}
                            durationMs={message.thoughtDurationMs}
                          />
                        )}

                        {/* Tool Calls Execution Cards */}
                        {message.toolCalls && message.toolCalls.length > 0 && (
                          <div className="space-y-1.5">
                            {message.toolCalls.map((tool) => (
                              <ToolCallCard key={tool.id} tool={tool} />
                            ))}
                          </div>
                        )}

                        {/* Interactive Tool Approval Card */}
                        {message.askUser && (
                          <AskUserCard
                            prompt={message.askUser}
                            onApprove={() => {
                              const pendingTool = message.toolCalls?.find((t) => t.status === "needs_approval")
                              if (pendingTool) {
                                void approveTool(message.id, pendingTool.id)
                              }
                            }}
                            onReject={(reason) => {
                              const pendingTool = message.toolCalls?.find((t) => t.status === "needs_approval")
                              if (pendingTool) {
                                rejectTool(message.id, pendingTool.id, reason)
                              }
                            }}
                          />
                        )}

                        {/* Markdown Output */}
                        {message.content && (
                          <div className="rounded-xl border bg-card/60 p-3.5 shadow-xs">
                            <ChatMarkdown content={message.content} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}

          {/* Streaming Indicator when Agent is thinking/generating */}
          {isStreaming && (
            <div className="flex gap-3 text-xs">
              <Avatar className="size-7 shrink-0 border bg-muted">
                <AvatarFallback className="text-[10px] font-medium">
                  <BotIcon className="size-3.5 text-primary animate-pulse" />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start w-full">
                <div className="mb-1 text-[10px] text-muted-foreground font-semibold">
                  {activeAgent?.name || "Agent"} is thinking...
                </div>
                <ThoughtTrace thought={streamingThought} isStreaming={true} defaultOpen={true} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sticky Composer */}
      <ChatComposer />
    </div>
  )
}
