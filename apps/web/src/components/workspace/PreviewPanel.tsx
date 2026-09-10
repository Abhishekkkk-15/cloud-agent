import {
  CopyIcon,
  ExternalLinkIcon,
  EyeIcon,
  LoaderCircleIcon,
  MonitorSmartphoneIcon,
  MoreVerticalIcon,
  RefreshCwIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  const previewKey = useWorkspaceStore((s) => s.previewKey)
  const reloadPreview = useWorkspaceStore((s) => s.reloadPreview)
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
    <div className="relative flex h-full min-h-0 flex-col bg-background">
      {/* Floating Preview Controls (Three-dot Menu) */}
      <div className="absolute top-2.5 right-2.5 z-20">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-xs"
                className="size-7 rounded-md border-border/80 bg-background/85 shadow-sm backdrop-blur-sm hover:bg-background transition-all"
                title="Preview options"
              />
            }
          >
            <MoreVerticalIcon className="size-3.5 text-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-1.5">
            <div className="px-2 py-1.5 flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="secondary"
                  className="h-4 px-1 text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-normal"
                >
                  Live
                </Badge>
                <span className="text-[11px] font-medium text-foreground">
                  Preview runtime
                </span>
              </div>
              <span
                className="text-[11px] font-mono text-muted-foreground truncate select-all"
                title={runSession.url ?? undefined}
              >
                {runSession.url ?? "Preview unavailable"}
              </span>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex cursor-pointer items-center gap-2 text-xs"
              onClick={reloadPreview}
            >
              <RefreshCwIcon className="size-3.5 text-muted-foreground" />
              <span>Refresh preview</span>
            </DropdownMenuItem>
            {runSession.url && (
              <DropdownMenuItem
                className="flex cursor-pointer items-center gap-2 text-xs"
                onClick={() =>
                  window.open(runSession.url!, "_blank", "noreferrer")
                }
              >
                <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
                <span>Redirect to live</span>
              </DropdownMenuItem>
            )}
            {runSession.url && (
              <DropdownMenuItem
                className="flex cursor-pointer items-center gap-2 text-xs"
                onClick={() => {
                  void navigator.clipboard.writeText(runSession.url!)
                  toast.success("Live URL copied to clipboard")
                }}
              >
                <CopyIcon className="size-3.5 text-muted-foreground" />
                <span>Copy live URL</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main Viewport */}
      <div className="h-full w-full min-h-0 flex-1 bg-background">
        {runSession.url ? (
          <iframe
            key={previewKey}
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
