import { useState } from "react"
import {
  ExternalLinkIcon,
  EyeIcon,
  LoaderCircleIcon,
  MonitorSmartphoneIcon,
  RefreshCwIcon,
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
  const [iframeKey, setIframeKey] = useState(0)
  const runSession = useWorkspaceStore((s) => s.runSession)
  const startRun = useWorkspaceStore((s) => s.startRun)
  const workspace = useWorkspaceStore((s) => s.workspace)

  // 1. Idle or Stopped State
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

  // 2. Starting State
  if (runSession.status === "starting") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <LoaderCircleIcon className="size-5 animate-spin" />
        Starting runtime & allocating ports…
      </div>
    )
  }

  // 3. Active Running State (Wildcard Preview Frame)
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Top Address/Control Bar */}
      <div className="flex h-10 items-center justify-between gap-2 border-b px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Badge
            variant="secondary"
            className="bg-emerald-500/10 text-emerald-600"
          >
            Live
          </Badge>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {runSession.url ?? "Preview unavailable"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Reload Iframe */}
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setIframeKey((prev) => prev + 1)}
            title="Reload Preview"
          >
            <RefreshCwIcon className="size-3.5" />
          </Button>

          {/* Open in New Window */}
          {runSession.url && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              asChild
              title="Open in new tab"
            >
              <a href={runSession.url} target="_blank" rel="noreferrer">
                <ExternalLinkIcon className="size-3.5" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Main Viewport */}
      <div className="min-h-0 flex-1 bg-background">
        {runSession.url ? (
          <iframe
            key={iframeKey}
            src={runSession.url}
            title={`${workspace?.title ?? "Workspace"} preview`}
            className="h-full w-full border-0"
            // Required for modern sandboxed apps running sub-requests
            allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
            sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Preview URL pending allocation...
          </div>
        )}
      </div>
    </div>
  )
}
