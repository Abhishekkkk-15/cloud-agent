import { useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeftIcon,
  PlayIcon,
  Share2Icon,
  SquareIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useWorkspaceStore } from "@/stores/workspace-store"

export function WorkspaceToolbar() {
  const workspace = useWorkspaceStore((s) => s.workspace)
  const runSession = useWorkspaceStore((s) => s.runSession)
  const startRun = useWorkspaceStore((s) => s.startRun)
  const stopRun = useWorkspaceStore((s) => s.stopRun)
  const setWorkspaceTab = useWorkspaceStore((s) => s.setWorkspaceTab)
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
    <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          render={<Link to="/dashboard" />}
          nativeButton={false}
          aria-label="Back to dashboard"
        >
          <ArrowLeftIcon />
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {workspace?.title ?? "Workspace"}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {workspace?.status ?? "Agent workspace"}
          </div>
        </div>
        {workspace && (
          <Badge variant="outline" className="hidden sm:inline-flex">
            {workspace.status}
          </Badge>
        )}
        {isRunning && (
          <Badge variant="secondary" className="hidden sm:inline-flex">
            Running
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isRunning ? (
          <Button variant="destructive" size="sm" onClick={stopRun}>
            <SquareIcon data-icon="inline-start" />
            Stop
          </Button>
        ) : (
          <Button size="sm" onClick={() => void handleRun()} disabled={running}>
            <PlayIcon data-icon="inline-start" />
            Run
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            toast.success("Share link copied", {
              description: `https://cloudagent.dev/w/${workspace?.id}`,
            })
          }
        >
          <Share2Icon data-icon="inline-start" />
          Share
        </Button>
      </div>
    </div>
  )
}
