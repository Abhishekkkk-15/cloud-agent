import {
  ExternalLinkIcon,
  EyeIcon,
  LoaderCircleIcon,
  MonitorSmartphoneIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useWorkspaceStore } from "@/stores/workspace-store"

export function PreviewPanel() {
  const runSession = useWorkspaceStore((s) => s.runSession)
  const startRun = useWorkspaceStore((s) => s.startRun)
  const project = useWorkspaceStore((s) => s.project)

  if (runSession.status === "idle" || runSession.status === "stopped") {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MonitorSmartphoneIcon />
            </EmptyMedia>
            <EmptyTitle>Webview offline</EmptyTitle>
            <EmptyDescription>
              Run the project to open a live preview for{" "}
              {project?.name ?? "this Repl"}.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => startRun()}>
              <EyeIcon data-icon="inline-start" />
              Run & preview
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  if (runSession.status === "starting") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <LoaderCircleIcon className="size-5 animate-spin" />
        Starting runtime…
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 items-center justify-between gap-2 border-b px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="secondary">Live</Badge>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {runSession.url}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          render={<a href={runSession.url ?? "#"} target="_blank" rel="noreferrer" />}
          nativeButton={false}
          aria-label="Open preview"
        >
          <ExternalLinkIcon />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/40 p-6">
        <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-sm">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Mock preview
          </p>
          <h3 className="mt-2 text-lg font-medium">{project?.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {project?.description}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted p-3">
              <div className="text-2xl font-medium">1.2k</div>
              <div className="text-xs text-muted-foreground">Requests</div>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <div className="text-2xl font-medium">98%</div>
              <div className="text-xs text-muted-foreground">Uptime</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
