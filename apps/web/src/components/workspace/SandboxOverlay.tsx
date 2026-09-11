import {
  AlertTriangleIcon,
  CheckIcon,
  CloudIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspace-store"

const STAGES = [
  { id: "container", label: "Environment" },
  { id: "network", label: "Networking" },
  { id: "runtime", label: "Ready" },
] as const

export function SandboxOverlay() {
  const sandbox = useWorkspaceStore((s) => s.sandbox)
  const dismissSandbox = useWorkspaceStore((s) => s.dismissSandbox)
  const retrySandbox = useWorkspaceStore((s) => s.retrySandbox)

  if (!sandbox.active) return null

  const { status, title, message, stage, error, details } = sandbox

  const isError = status === "error"
  const isReady = status === "ready"
  const isResuming = status === "resuming"
  const isProvisioning = status === "provisioning"
  const isLoading = !isError && !isReady

  const stageIndex =
    isReady || stage === "ready" || stage === "runtime"
      ? 2
      : stage === "ports" || stage === "network"
        ? 1
        : 0

  const displayTitle =
    title ||
    (isError
      ? "Couldn’t start workspace"
      : isReady
        ? "Workspace ready"
        : isResuming
          ? "Resuming workspace"
          : isProvisioning
            ? "Setting up workspace"
            : "Starting workspace")

  const displayMessage =
    message ||
    (isError
      ? error || "Something went wrong while preparing your environment."
      : isReady
        ? "Your development environment is online."
        : isResuming
          ? "Restoring your development environment…"
          : isProvisioning
            ? "Preparing resources for this workspace…"
            : "Spinning up your isolated environment…")

  const badgeLabel = isError
    ? "Failed"
    : isReady
      ? "Online"
      : isResuming
        ? "Resuming"
        : isProvisioning
          ? "Provisioning"
          : "Starting"

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sandbox-overlay-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm animate-in fade-in-0"
    >
      <Card
        size="sm"
        className="relative w-full max-w-sm shadow-lg animate-in zoom-in-95 duration-200"
      >
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={dismissSandbox}
          className="absolute top-2.5 right-2.5 z-10 text-muted-foreground"
          aria-label="Dismiss"
        >
          <XIcon />
        </Button>

        <CardHeader className="items-center text-center">
          <div
            className={cn(
              "mb-1 flex size-11 items-center justify-center rounded-xl border border-border bg-muted/50",
              isError && "border-destructive/30 bg-destructive/10",
              isReady && "border-emerald-500/30 bg-emerald-500/10"
            )}
          >
            {isError ? (
              <AlertTriangleIcon className="size-5 text-destructive" />
            ) : isReady ? (
              <CheckIcon className="size-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <div className="relative flex size-5 items-center justify-center">
                <CloudIcon className="size-5 text-muted-foreground" />
                <Spinner className="absolute -right-1.5 -bottom-1.5 size-3.5 text-foreground" />
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-2">
            <Badge
              variant="secondary"
              className={cn(
                "h-5 gap-1.5 px-2 text-[10px] font-normal",
                isError && "bg-destructive/10 text-destructive",
                isReady &&
                  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                isLoading && "bg-muted text-muted-foreground"
              )}
            >
              {isLoading ? (
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground/50 opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-foreground/70" />
                </span>
              ) : (
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    isReady ? "bg-emerald-500" : "bg-destructive"
                  )}
                />
              )}
              {badgeLabel}
            </Badge>
          </div>

          <CardTitle
            id="sandbox-overlay-title"
            className="text-base font-semibold tracking-tight"
          >
            {displayTitle}
          </CardTitle>
          <CardDescription className="max-w-[18rem] text-pretty">
            {displayMessage}
          </CardDescription>
        </CardHeader>

        {isLoading && (
          <CardContent className="flex flex-col gap-3">
            <Separator />
            <ol className="flex flex-col gap-2">
              {STAGES.map((s, idx) => {
                const isCompleted = idx < stageIndex
                const isCurrent = idx === stageIndex
                return (
                  <li
                    key={s.id}
                    className="flex items-center gap-2.5 text-xs"
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-medium",
                        isCompleted &&
                          "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                        isCurrent &&
                          "border-foreground/20 bg-muted text-foreground",
                        !isCompleted &&
                          !isCurrent &&
                          "border-border bg-background text-muted-foreground/60"
                      )}
                    >
                      {isCompleted ? (
                        <CheckIcon className="size-3" />
                      ) : isCurrent ? (
                        <Spinner className="size-3" />
                      ) : (
                        idx + 1
                      )}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate",
                        isCurrent
                          ? "font-medium text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {s.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] text-muted-foreground">
                        In progress
                      </span>
                    )}
                    {isCompleted && (
                      <span className="text-[10px] text-muted-foreground">
                        Done
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          </CardContent>
        )}

        {isError && (
          <>
            <CardContent>
              <Alert variant="destructive">
                <AlertTriangleIcon />
                <AlertTitle>Startup failed</AlertTitle>
                <AlertDescription className="break-words">
                  {error || message}
                  {details ? (
                    <span className="mt-1 block text-muted-foreground">
                      {details}
                    </span>
                  ) : null}
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="justify-end gap-2 border-t">
              <Button variant="outline" size="sm" onClick={dismissSandbox}>
                Dismiss
              </Button>
              <Button size="sm" onClick={() => void retrySandbox()}>
                <RefreshCwIcon data-icon="inline-start" />
                Retry
              </Button>
            </CardFooter>
          </>
        )}

        {isReady && (
          <CardFooter className="justify-center border-t">
            <Button size="sm" onClick={dismissSandbox}>
              Continue
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
