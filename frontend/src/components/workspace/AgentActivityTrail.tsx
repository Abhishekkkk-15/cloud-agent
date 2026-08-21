import {
  CheckIcon,
  FilePenLineIcon,
  FileSearchIcon,
  LightbulbIcon,
  TerminalIcon,
} from "lucide-react"

import { Spinner } from "@/components/ui/spinner"
import { useWorkspaceStore } from "@/stores/workspace-store"
import type { AgentActivity } from "@/types/schemas"
import { cn } from "@/lib/utils"

const typeIcon = {
  think: LightbulbIcon,
  read_file: FileSearchIcon,
  edit_file: FilePenLineIcon,
  run_command: TerminalIcon,
} as const

type AgentActivityTrailProps = {
  activities: AgentActivity[]
}

export function AgentActivityTrail({ activities }: AgentActivityTrailProps) {
  const openFile = useWorkspaceStore((s) => s.openFile)

  if (activities.length === 0) return null

  return (
    <div className="flex w-full max-w-[90%] flex-col gap-1 rounded-xl border bg-muted/40 p-2">
      {activities.map((activity) => {
        const Icon = typeIcon[activity.type]
        const clickable =
          (activity.type === "read_file" || activity.type === "edit_file") &&
          !!activity.fileId

        return (
          <button
            key={activity.id}
            type="button"
            disabled={!clickable}
            onClick={() => {
              if (activity.fileId) openFile(activity.fileId)
            }}
            className={cn(
              "flex items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs",
              clickable && "hover:bg-muted",
              !clickable && "cursor-default"
            )}
          >
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
              {activity.status === "running" ? (
                <Spinner className="size-3.5" />
              ) : activity.status === "done" ? (
                <CheckIcon className="size-3.5 text-muted-foreground" />
              ) : (
                <Icon className="size-3.5 text-muted-foreground" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block font-medium",
                  activity.status === "pending" && "text-muted-foreground"
                )}
              >
                {activity.label}
              </span>
              {(activity.detail || activity.command) && (
                <span className="block truncate text-muted-foreground">
                  {activity.command ?? activity.detail}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
