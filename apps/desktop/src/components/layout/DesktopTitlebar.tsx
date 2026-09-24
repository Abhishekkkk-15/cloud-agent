import {
  ActivityIcon,
  ChevronDownIcon,
  FolderGit2Icon,
  MinusIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SparklesIcon,
  SquareIcon,
  XIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAgentStore } from "@/stores/agent-store"

export function DesktopTitlebar({ onOpenPairModal }: { onOpenPairModal?: () => void }) {
  const sidebarOpen = useAgentStore((s) => s.sidebarOpen)
  const toggleSidebar = useAgentStore((s) => s.toggleSidebar)
  const agents = useAgentStore((s) => s.agents)
  const activeAgentId = useAgentStore((s) => s.activeAgentId)
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent)
  const projects = useAgentStore((s) => s.projects)
  const activeProjectId = useAgentStore((s) => s.activeProjectId)
  const setActiveProject = useAgentStore((s) => s.setActiveProject)

  const activeAgent = agents.find((a) => a.id === activeAgentId)
  const activeProject = projects.find((p) => p.id === activeProjectId)

  // Window minimize / maximize / close helpers (fallback if not in Tauri window)
  const handleMinimize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window")
      await getCurrentWindow().minimize()
    } catch {
      // Running in browser dev mode
    }
  }

  const handleMaximize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window")
      await getCurrentWindow().toggleMaximize()
    } catch {
      // Running in browser dev mode
    }
  }

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window")
      await getCurrentWindow().close()
    } catch {
      // Running in browser dev mode
    }
  }

  return (
    <header
      data-tauri-drag-region
      className="flex h-10 w-full shrink-0 select-none items-center justify-between border-b bg-card px-3 text-xs"
    >
      {/* Left: Sidebar toggle, App Branding & Project selector */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-xs"
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={toggleSidebar}
          title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          {sidebarOpen ? (
            <PanelLeftCloseIcon className="size-4" />
          ) : (
            <PanelLeftOpenIcon className="size-4" />
          )}
        </Button>

        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <span className="flex size-4.5 items-center justify-center rounded-sm bg-primary text-[10px] font-bold text-primary-foreground">
            C
          </span>
          <span className="hidden sm:inline">Cloud Agent</span>
        </div>

        <span className="text-muted-foreground/40">/</span>

        {/* Project Selector Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
              />
            }
          >
            <FolderGit2Icon className="size-3.5 text-muted-foreground" />
            <span className="max-w-[140px] truncate">{activeProject?.name || "Select Project"}</span>
            {activeProject?.gitBranch && (
              <Badge variant="outline" className="h-4 px-1 text-[10px] font-mono text-muted-foreground">
                {activeProject.gitBranch}
              </Badge>
            )}
            <ChevronDownIcon className="size-3 text-muted-foreground opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Local Workspaces</DropdownMenuLabel>
            {projects.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => setActiveProject(p.id)}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex flex-col gap-0.5 truncate">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-[10px] text-muted-foreground truncate">{p.path}</span>
                </div>
                {p.id === activeProjectId && (
                  <Badge variant="secondary" className="text-[10px]">Active</Badge>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs text-primary gap-1.5 cursor-pointer">
              <span>+ Open Local Folder...</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Center: Active Agent Status & P2P indicator */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium hover:bg-muted transition-colors"
              />
            }
          >
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{activeAgent?.name || "Agent"}</span>
            <span className="text-muted-foreground/60 font-mono text-[10px]">{activeAgent?.version}</span>
            <ChevronDownIcon className="size-3 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Coding Agent Engine</DropdownMenuLabel>
            {agents.map((ag) => (
              <DropdownMenuItem
                key={ag.id}
                onClick={() => setActiveAgent(ag.id)}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <SparklesIcon className="size-3.5 text-primary" />
                  <div className="flex flex-col">
                    <span className="font-medium">{ag.name}</span>
                    <span className="text-[10px] text-muted-foreground">{ag.description}</span>
                  </div>
                </div>
                {ag.id === activeAgentId && (
                  <Badge variant="secondary" className="text-[10px]">Active</Badge>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* WebRTC P2P Status Badge */}
        <button
          type="button"
          onClick={onOpenPairModal}
          className="hidden md:flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 transition-colors cursor-pointer"
          title="Direct P2P DataChannel Active (Click to pair phone or browser)"
        >
          <ActivityIcon className="size-3" />
          <span>WebRTC P2P: 1ms</span>
        </button>
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-xs"
          className="size-7 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={handleMinimize}
          title="Minimize"
        >
          <MinusIcon className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="size-7 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={handleMaximize}
          title="Maximize"
        >
          <SquareIcon className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="size-7 rounded-sm text-muted-foreground hover:bg-rose-500 hover:text-white"
          onClick={handleClose}
          title="Close"
        >
          <XIcon className="size-3.5" />
        </Button>
      </div>
    </header>
  )
}
