import { useState } from "react"
import {
  FolderGit2Icon,
  MessageSquareIcon,
  PlusIcon,
  QrCodeIcon,
  SearchIcon,
  Trash2Icon,
  ZapIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAgentStore } from "@/stores/agent-store"

export function DesktopSidebar({ onOpenPairModal }: { onOpenPairModal?: () => void }) {
  const sidebarOpen = useAgentStore((s) => s.sidebarOpen)
  const agents = useAgentStore((s) => s.agents)
  const activeAgentId = useAgentStore((s) => s.activeAgentId)
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)
  const projects = useAgentStore((s) => s.projects)
  const activeProjectId = useAgentStore((s) => s.activeProjectId)
  const sessions = useAgentStore((s) => s.sessions)
  const activeSessionId = useAgentStore((s) => s.activeSessionId)
  const setActiveSession = useAgentStore((s) => s.setActiveSession)
  const createNewSession = useAgentStore((s) => s.createNewSession)
  const deleteSession = useAgentStore((s) => s.deleteSession)

  const [search, setSearch] = useState("")

  if (!sidebarOpen) return null

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  )

  const activeProject = projects.find((p) => p.id === activeProjectId)

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-card text-xs select-none">
      {/* 1. Project Header */}
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] font-semibold tracking-wider uppercase">Workspace</span>
          <span className="text-[10px] font-mono text-muted-foreground/60">{activeProject?.gitBranch || "local"}</span>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-2">
          <div className="flex items-center gap-2 min-w-0">
            <FolderGit2Icon className="size-4 text-primary shrink-0" />
            <div className="flex flex-col truncate">
              <span className="font-semibold text-foreground truncate">{activeProject?.name}</span>
              <span className="text-[10px] text-muted-foreground truncate">{activeProject?.path}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Agents Selector Tabs */}
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-[11px] font-semibold tracking-wider uppercase">Coding Agents</span>
          <Badge variant="outline" className="h-4 px-1 text-[9px] font-normal">
            {agents.filter((a) => a.status === "connected").length} Connected
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {agents.map((ag) => {
            const isSelected = ag.id === activeAgentId
            const isConnected = ag.status === "connected"

            return (
              <button
                key={ag.id}
                type="button"
                onClick={() => setActiveAgent(ag.id)}
                className={`flex flex-col items-start gap-1 rounded-lg border p-2 text-left transition-all cursor-pointer ${
                  isSelected
                    ? "border-primary bg-primary/10 text-foreground shadow-xs"
                    : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-semibold text-[11px] truncate">{ag.name.replace(" CLI", "")}</span>
                  <span
                    className={`size-1.5 rounded-full ${
                      isConnected ? "bg-emerald-500" : "bg-muted-foreground/40"
                    }`}
                  />
                </div>
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-mono">
                  <span>${ag.cliName}</span>
                  {ag.isAutonomous && <ZapIcon className="size-2 text-amber-500" />}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Sessions / Tasks List */}
      <div className="flex flex-1 flex-col min-h-0">
        <div className="flex items-center justify-between p-3 pb-2">
          <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Sessions
          </span>
          <Button
            size="icon-xs"
            variant="ghost"
            className="size-5 rounded-md hover:bg-muted"
            onClick={() => createNewSession()}
            title="Start new task/session"
          >
            <PlusIcon className="size-3.5" />
          </Button>
        </div>

        {/* Search Input */}
        <div className="px-3 pb-2">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-2 size-3 text-muted-foreground" />
            <Input
              placeholder="Search sessions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 pl-7 text-[11px]"
            />
          </div>
        </div>

        {/* Scrollable Session List */}
        <ScrollArea className="flex-1 px-2">
          <div className="space-y-1 pb-3">
            {filteredSessions.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No sessions found
              </div>
            ) : (
              filteredSessions.map((session) => {
                const isSelected = session.id === activeSessionId

                return (
                  <div
                    key={session.id}
                    onClick={() => setActiveSession(session.id)}
                    className={`group flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquareIcon className="size-3.5 shrink-0 opacity-70" />
                      <div className="flex flex-col truncate">
                        <span className="truncate text-xs">{session.title}</span>
                        <span className="text-[10px] text-muted-foreground/70 font-mono">
                          {session.updatedAt}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteSession(session.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 hover:text-rose-500 p-0.5 rounded transition-opacity"
                      title="Delete session"
                    >
                      <Trash2Icon className="size-3" />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* 4. Bottom Daemon Status & Pair Mobile Device */}
      <div className="border-t p-3 bg-muted/20 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>Local Daemon Ready</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">PID 12480</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs gap-1.5 border-dashed hover:border-primary hover:text-primary transition-colors"
          onClick={onOpenPairModal}
        >
          <QrCodeIcon className="size-3.5" />
          <span>Pair Phone or Web</span>
        </Button>
      </div>
    </aside>
  )
}
