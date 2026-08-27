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
  const workspace = useWorkspaceStore((s) => s.workspace)

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
              Run the workspace to open a live preview for{" "}
              {workspace?.title ?? "this app"}.
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
            {runSession.url ?? "Preview unavailable"}
          </span>
        </div>
        {runSession.url ? (
          <Button
            variant="ghost"
            size="icon-sm"
            render={
              <a href={runSession.url} target="_blank" rel="noreferrer" />
            }
            nativeButton={false}
            aria-label="Open preview"
          >
            <ExternalLinkIcon />
          </Button>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/40 p-6">
        <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-sm text-center">
          <h3 className="text-lg font-medium">{workspace?.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Preview is not connected yet. Run will execute in the terminal once
            the sandbox preview API is wired.
          </p>
        </div>
      </div>
    </div>
  )
}
