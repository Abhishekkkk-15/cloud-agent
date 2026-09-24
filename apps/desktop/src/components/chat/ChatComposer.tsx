import { useRef, useState } from "react"
import {
  ArrowUpIcon,
  BotIcon,
  ChevronDownIcon,
  FolderIcon,
  PaperclipIcon,
  ShieldCheckIcon,
  SquareIcon,
  ZapIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAgentStore } from "@/stores/agent-store"

export function ChatComposer() {
  const [prompt, setPrompt] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isStreaming = useAgentStore((s) => s.isStreaming)
  const sendMessage = useAgentStore((s) => s.sendMessage)
  const activeAgentId = useAgentStore((s) => s.activeAgentId)
  const agents = useAgentStore((s) => s.agents)
  const setAgentModel = useAgentStore((s) => s.setAgentModel)
  const toggleAgentAutonomous = useAgentStore((s) => s.toggleAgentAutonomous)
  const activeProjectId = useAgentStore((s) => s.activeProjectId)
  const projects = useAgentStore((s) => s.projects)

  const activeAgent = agents.find((a) => a.id === activeAgentId)
  const activeProject = projects.find((p) => p.id === activeProjectId)

  const handleSend = async () => {
    const trimmed = prompt.trim()
    if (!trimmed || isStreaming) return
    setPrompt("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
    await sendMessage(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value)
    // Auto-grow
    const target = e.target
    target.style.height = "auto"
    target.style.height = `${Math.min(target.scrollHeight, 200)}px`
  }

  return (
    <div className="border-t bg-background/95 backdrop-blur px-4 py-3">
      <div className="mx-auto max-w-4xl space-y-2">
        {/* Composer Card Container */}
        <div className="relative rounded-2xl border bg-card/80 p-2.5 shadow-sm transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
          {/* Main Textarea */}
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder={
              isStreaming
                ? "Agent is executing tasks..."
                : `Message ${activeAgent?.name || "Agent"}... (Shift+Enter for new line)`
            }
            rows={2}
            className="w-full resize-none bg-transparent px-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50"
          />

          {/* Bottom Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 mt-1">
            {/* Left: Model Selector & Autonomous Toggle */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Model Picker */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                    />
                  }
                >
                  <BotIcon className="size-3 text-primary" />
                  <span>{activeAgent?.activeModel || "Model"}</span>
                  <ChevronDownIcon className="size-2.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Select Model</DropdownMenuLabel>
                  {activeAgent?.models.map((m) => (
                    <DropdownMenuItem
                      key={m}
                      onClick={() => setAgentModel(activeAgent.id, m)}
                      className="flex items-center justify-between text-xs"
                    >
                      <span>{m}</span>
                      {m === activeAgent.activeModel && (
                        <Badge variant="secondary" className="text-[10px]">Active</Badge>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Autonomous Mode Toggle */}
              <button
                type="button"
                onClick={() => activeAgent && toggleAgentAutonomous(activeAgent.id)}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                  activeAgent?.isAutonomous
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                }`}
                title={
                  activeAgent?.isAutonomous
                    ? "Autonomous: Safe tools run automatically"
                    : "Supervised: Prompts for confirmation before tools"
                }
              >
                {activeAgent?.isAutonomous ? (
                  <>
                    <ZapIcon className="size-3 text-emerald-500" />
                    <span>Autonomous</span>
                  </>
                ) : (
                  <>
                    <ShieldCheckIcon className="size-3 text-muted-foreground" />
                    <span>Supervised</span>
                  </>
                )}
              </button>

              {/* Working Folder Tag */}
              {activeProject && (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground font-mono truncate max-w-[180px]">
                  <FolderIcon className="size-2.5" />
                  {activeProject.name}
                </span>
              )}
            </div>

            {/* Right: Attachment & Send Button */}
            <div className="flex items-center gap-1.5 ml-auto">
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-7 rounded-full text-muted-foreground hover:text-foreground"
                title="Attach files / images (Coming soon)"
                disabled={isStreaming}
              >
                <PaperclipIcon className="size-3.5" />
              </Button>

              <Button
                size="icon-xs"
                className="size-7 rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-40"
                onClick={handleSend}
                disabled={!prompt.trim() || isStreaming}
                title="Send message (Enter)"
              >
                {isStreaming ? (
                  <SquareIcon className="size-3 fill-current animate-pulse" />
                ) : (
                  <ArrowUpIcon className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Footer Hint */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 px-1">
          <span>Connected via local daemon over direct P2P DataChannel</span>
          <span>Shift + Enter for new line · Enter to send</span>
        </div>
      </div>
    </div>
  )
}
