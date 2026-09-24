import { useState, useRef } from "react"
import { RefreshCwIcon, Trash2Icon, TerminalSquareIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { cn } from "@/lib/utils"
import { XTermView } from "./terminal/XTermView"

export function TerminalPanel() {
  const workspace = useWorkspaceStore((s) => s.workspace)
  const [shellStatus, setShellStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("connecting")

  const shellActionsRef = useRef<{ clear: () => void; reconnect: () => void } | null>(null)

  const workspaceId = workspace?.id

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header Bar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          <TerminalSquareIcon className="size-4 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">Terminal</span>
          <span
            className={cn(
              "size-1.5 rounded-full transition-colors",
              shellStatus === "connected" && "bg-emerald-500",
              shellStatus === "connecting" && "bg-amber-400 animate-pulse",
              (shellStatus === "disconnected" || shellStatus === "error") &&
                "bg-muted-foreground/40"
            )}
            title={`Status: ${shellStatus}`}
          />
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => shellActionsRef.current?.clear()}
            title="Clear Terminal"
          >
            <Trash2Icon className="size-3" />
            Clear
          </Button>
          <Button
            variant="ghost"
            size="xs"
            className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => shellActionsRef.current?.reconnect()}
            title="Restart Session"
          >
            <RefreshCwIcon className="size-3" />
            Restart
          </Button>
        </div>
      </div>

      {/* Terminal View */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {workspaceId ? (
          <XTermView
            workspaceId={workspaceId}
            onStatusChange={setShellStatus}
            onRegisterActions={(actions) => {
              shellActionsRef.current = actions
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No active workspace
          </div>
        )}
      </div>
    </div>
  )
}
