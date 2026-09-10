import { useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeftIcon,
  Code2Icon,
  EyeIcon,
  PlayIcon,
  Share2Icon,
  SquareIcon,
  TerminalIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useWorkspaceStore } from "@/stores/workspace-store"

export function WorkspaceToolbar() {
  const workspace = useWorkspaceStore((s) => s.workspace)
  const runSession = useWorkspaceStore((s) => s.runSession)
  const startRun = useWorkspaceStore((s) => s.startRun)
  const stopRun = useWorkspaceStore((s) => s.stopRun)
  const workspaceTab = useWorkspaceStore((s) => s.workspaceTab)
  const setWorkspaceTab = useWorkspaceStore((s) => s.setWorkspaceTab)
  const activeFileName = useWorkspaceStore((s) => s.getActiveFile()?.name)
  const [running, setRunning] = useState(false)

  const isRunning =
    runSession.status === "running" || runSession.status === "starting"

  async function handleRun() {
    setRunning(true)
    setWorkspaceTab("preview")
    try {
      await startRun()
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b px-3 bg-background">
      {/* Left: Navigation, Workspace Title & Status */}
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon-xs"
          className="size-7"
          render={<Link to="/dashboard" />}
          nativeButton={false}
          aria-label="Back to dashboard"
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-sm font-medium text-foreground">
            {workspace?.title ?? "Workspace"}
          </span>
          {workspace && (
            <Badge variant="outline" className="hidden sm:inline-flex text-[10px] h-4.5 px-1.5 font-normal">
              {workspace.status}
            </Badge>
          )}
          {isRunning && (
            <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] h-4.5 px-1.5 font-normal bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
              Running
            </Badge>
          )}
          {activeFileName && (
            <span className="hidden md:inline truncate text-xs text-muted-foreground">
              · editing {activeFileName}
            </span>
          )}
        </div>
      </div>

      {/* Center: Combined Workspace Tabs (Preview / Code / Console) */}
      <div className="flex items-center">
        <Tabs
          value={workspaceTab}
          onValueChange={(val) => {
            if (val === "preview" || val === "code" || val === "console") {
              setWorkspaceTab(val)
            }
          }}
        >
          <TabsList className="h-8 p-0.5 bg-muted/60">
            <TabsTrigger
              value="preview"
              className="h-7 px-3 text-xs gap-1.5 data-active:bg-background data-active:text-foreground data-active:shadow-xs"
            >
              <EyeIcon className="size-3.5" />
              <span>Preview</span>
            </TabsTrigger>
            <TabsTrigger
              value="code"
              className="h-7 px-3 text-xs gap-1.5 data-active:bg-background data-active:text-foreground data-active:shadow-xs"
            >
              <Code2Icon className="size-3.5" />
              <span>Code</span>
            </TabsTrigger>
            <TabsTrigger
              value="console"
              className="h-7 px-3 text-xs gap-1.5 data-active:bg-background data-active:text-foreground data-active:shadow-xs"
            >
              <TerminalIcon className="size-3.5" />
              <span>Console</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {isRunning ? (
          <Button
            variant="destructive"
            size="sm"
            className="h-7 px-2.5 text-xs gap-1"
            onClick={stopRun}
          >
            <SquareIcon className="size-3" />
            <span>Stop</span>
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-7 px-2.5 text-xs gap-1"
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
          className="h-7 px-2.5 text-xs gap-1"
          onClick={() =>
            toast.success("Share link copied", {
              description: `https://cloudagent.dev/w/${workspace?.id}`,
            })
          }
        >
          <Share2Icon className="size-3" />
          <span className="hidden sm:inline">Share</span>
        </Button>
      </div>
    </div>
  )
}
