import { useState } from "react"
import {
  ChevronDownIcon,
  Code2Icon,
  DownloadIcon,
  Loader2Icon,
  MinusIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlayIcon,
  QrCodeIcon,
  Share2Icon,
  SquareIcon,
  SquareStackIcon,
  TerminalIcon,
  WifiIcon,
  XIcon,
  ZapIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { downloadWorkspaceZip } from "@/lib/api"
import { getApiErrorMessage } from "@/lib/http"
import { useWorkspaceStore } from "@/stores/workspace-store"

export function WorkspaceToolbar({ onOpenPairModal }: { onOpenPairModal?: () => void }) {
  const workspace = useWorkspaceStore((s) => s.workspace)
  const agents = useWorkspaceStore((s) => s.agents)
  const activeAgentId = useWorkspaceStore((s) => s.activeAgentId)
  const setActiveAgent = useWorkspaceStore((s) => s.setActiveAgent)
  const setAgentModel = useWorkspaceStore((s) => s.setAgentModel)
  const toggleAgentAutonomous = useWorkspaceStore((s) => s.toggleAgentAutonomous)

  const runSession = useWorkspaceStore((s) => s.runSession)
  const startRun = useWorkspaceStore((s) => s.startRun)
  const stopRun = useWorkspaceStore((s) => s.stopRun)
  const workspaceTab = useWorkspaceStore((s) => s.workspaceTab)
  const setWorkspaceTab = useWorkspaceStore((s) => s.setWorkspaceTab)
  const activeFileName = useWorkspaceStore((s) => s.getActiveFile()?.name)

  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen)
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar)

  const [running, setRunning] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const activeAgent = agents.find((a) => a.id === activeAgentId) || agents[0]
  const isRunning =
    runSession.status === "running" || runSession.status === "starting"

  async function handleRun() {
    setRunning(true)
    setWorkspaceTab("console")
    try {
      await startRun()
    } finally {
      setRunning(false)
    }
  }

  async function handleDownload() {
    if (!workspace?.id || downloading) return
    setDownloading(true)
    try {
      await downloadWorkspaceZip(workspace.id, workspace.title)
      toast.success("Download started", {
        description: "Your project ZIP is downloading.",
      })
    } catch (err) {
      toast.error("Download failed", {
        description: getApiErrorMessage(err, "Failed to download project zip"),
      })
    } finally {
      setDownloading(false)
    }
  }

  // Tauri window handlers
  const handleMinimize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window")
      await getCurrentWindow().minimize()
    } catch {
      // Non-tauri browser mode fallback
    }
  }

  const handleMaximize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window")
      await getCurrentWindow().toggleMaximize()
    } catch {
      // Non-tauri browser mode fallback
    }
  }

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window")
      await getCurrentWindow().close()
    } catch {
      // Non-tauri browser mode fallback
    }
  }

  return (
    <header
      data-tauri-drag-region
      className="flex h-11 shrink-0 items-center justify-between gap-2 border-b px-2 bg-background select-none"
    >
      {/* Left: Sidebar Toggle, Workspace Title & Status */}
      <div className="flex min-w-0 items-center gap-1.5" data-tauri-drag-region="false">
        <Button
          variant="ghost"
          size="icon-xs"
          className="size-7"
          onClick={toggleSidebar}
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarOpen ? (
            <PanelLeftCloseIcon className="size-4 text-muted-foreground" />
          ) : (
            <PanelLeftOpenIcon className="size-4 text-muted-foreground" />
          )}
        </Button>

        <Separator orientation="vertical" className="h-4" />

        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-xs font-semibold text-foreground">
            {workspace?.title ?? "Workspace"}
          </span>
          {workspace && (
            <Badge variant="outline" className="hidden sm:inline-flex text-[9px] h-4 px-1 font-mono text-muted-foreground">
              {workspace.status}
            </Badge>
          )}
          {isRunning && (
            <Badge variant="secondary" className="hidden sm:inline-flex text-[9px] h-4 px-1 font-normal bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
              Running
            </Badge>
          )}
          {activeFileName && (
            <span className="hidden lg:inline truncate text-[11px] text-muted-foreground">
              · editing {activeFileName}
            </span>
          )}
        </div>

        <Separator orientation="vertical" className="h-4 mx-1" />

        {/* AGENT / CLI SELECTOR DROPDOWN */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md border bg-muted/40 hover:bg-muted px-2 py-1 text-xs font-medium transition-colors cursor-pointer"
              />
            }
          >
            <div className="flex items-center gap-1.5">
              <span className="relative flex size-2">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  activeAgent.status === "connected"
                    ? "bg-emerald-400 animate-ping"
                    : "bg-amber-400"
                }`} />
                <span className={`relative inline-flex size-2 rounded-full ${
                  activeAgent.status === "connected" ? "bg-emerald-500" : "bg-amber-500"
                }`} />
              </span>
              <span className="font-semibold text-foreground">{activeAgent.name}</span>
              <Badge variant="secondary" className="h-3.5 px-1 text-[9px] font-mono">
                {activeAgent.cliName}
              </Badge>
            </div>
            <ChevronDownIcon className="size-3 text-muted-foreground ml-1" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Select Coding Agent / CLI
              </DropdownMenuLabel>
              {agents.map((agent) => (
                <DropdownMenuItem
                  key={agent.id}
                  onClick={() => setActiveAgent(agent.id)}
                  className="flex items-center justify-between text-xs cursor-pointer py-1.5"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{agent.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        ({agent.cliName})
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{agent.description}</span>
                  </div>
                  {agent.id === activeAgentId && (
                    <Badge variant="default" className="text-[9px] h-4 px-1 shrink-0">
                      Active
                    </Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Agent Model ({activeAgent.name})
              </DropdownMenuLabel>
              {activeAgent.models.map((model) => (
                <DropdownMenuItem
                  key={model}
                  onClick={() => setAgentModel(activeAgent.id, model)}
                  className="flex items-center justify-between text-xs cursor-pointer py-1"
                >
                  <span>{model}</span>
                  {model === activeAgent.activeModel && (
                    <Badge variant="outline" className="text-[9px] h-3.5 px-1">
                      Selected
                    </Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => toggleAgentAutonomous(activeAgent.id)}
              className="flex items-center justify-between text-xs cursor-pointer py-1.5"
            >
              <div className="flex items-center gap-1.5">
                <ZapIcon className={`size-3 ${activeAgent.isAutonomous ? "text-amber-500" : "text-muted-foreground"}`} />
                <span>Autonomous Execution</span>
              </div>
              <Badge
                variant={activeAgent.isAutonomous ? "default" : "outline"}
                className="text-[9px] h-4 px-1 font-mono"
              >
                {activeAgent.isAutonomous ? "AUTO" : "SUPERVISED"}
              </Badge>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Center: Tabs (Code / Console) — NO PREVIEW */}
      <div className="flex items-center" data-tauri-drag-region="false">
        <Tabs
          value={workspaceTab}
          onValueChange={(val) => {
            if (val === "code" || val === "console") {
              setWorkspaceTab(val)
            }
          }}
        >
          <TabsList className="h-7 p-0.5 bg-muted/60">
            <TabsTrigger
              value="code"
              className="h-6 px-3 text-xs gap-1.5 data-active:bg-background data-active:text-foreground data-active:shadow-xs"
            >
              <Code2Icon className="size-3.5" />
              <span>Code</span>
            </TabsTrigger>
            <TabsTrigger
              value="console"
              className="h-6 px-3 text-xs gap-1.5 data-active:bg-background data-active:text-foreground data-active:shadow-xs"
            >
              <TerminalIcon className="size-3.5" />
              <span>Console</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Right: Actions & Window Controls */}
      <div className="flex items-center gap-1.5" data-tauri-drag-region="false">
        {/* P2P WebRTC connection status */}
        <Badge
          variant="outline"
          className="h-5 px-1.5 gap-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hidden md:inline-flex"
        >
          <WifiIcon className="size-2.5" />
          <span>P2P Direct · 1ms</span>
        </Badge>

        {isRunning ? (
          <Button
            variant="destructive"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={stopRun}
          >
            <SquareIcon className="size-3" />
            <span>Stop</span>
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => void handleRun()}
            disabled={running}
          >
            <PlayIcon className="size-3" />
            <span>Run</span>
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onClick={() =>
            toast.success("Local P2P Share link copied", {
              description: `cloudagent://connect?peer=${workspace?.id}`,
            })
          }
        >
          <Share2Icon className="size-3" />
          <span className="hidden xl:inline">Share</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onClick={() => void handleDownload()}
          disabled={downloading}
          title="Download project as ZIP"
        >
          {downloading ? (
            <Loader2Icon className="size-3 animate-spin text-primary" />
          ) : (
            <DownloadIcon className="size-3" />
          )}
          <span className="hidden xl:inline">
            {downloading ? "Downloading…" : "Download ZIP"}
          </span>
        </Button>

        {onOpenPairModal && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={onOpenPairModal}
            title="Pair Phone or Web"
          >
            <QrCodeIcon className="size-3" />
            <span className="hidden sm:inline">Pair</span>
          </Button>
        )}

        {/* Window controls for frameless Tauri window */}
        <div className="flex items-center ml-1 border-l pl-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleMinimize}
            className="size-7 rounded-none hover:bg-muted"
            title="Minimize"
          >
            <MinusIcon className="size-3 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleMaximize}
            className="size-7 rounded-none hover:bg-muted"
            title="Maximize"
          >
            <SquareStackIcon className="size-3 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleClose}
            className="size-7 rounded-none hover:bg-destructive hover:text-destructive-foreground"
            title="Close"
          >
            <XIcon className="size-3" />
          </Button>
        </div>
      </div>
    </header>
  )
}
