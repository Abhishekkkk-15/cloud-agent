import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CheckIcon,
  CpuIcon,
  BoxesIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspace-store"

const STAGES = [
  { id: "container", label: "Container" },
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

  // Determine stage progression
  const stageIndex =
    isReady || stage === "ready" || stage === "runtime"
      ? 2
      : stage === "ports" || stage === "network"
        ? 1
        : 0

  const displayTitle =
    title ||
    (isError
      ? "Sandbox Initialization Failed"
      : isReady
        ? "Sandbox Environment Ready"
        : isResuming
          ? "Resuming Sandbox"
          : isProvisioning
            ? "Provisioning Docker Sandbox"
            : "Starting Sandbox Runtime")

  const displayMessage =
    message ||
    (isError
      ? error || "An unexpected error occurred while starting the sandbox."
      : isReady
        ? "Docker container and proxy routes are online."
        : isResuming
          ? "Restoring your development environment..."
          : isProvisioning
            ? "Allocating resources and configuring environment..."
            : "Preparing Docker container runtime...")

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none bg-background/80 backdrop-blur-md transition-all duration-300 animate-in fade-in-0"
    >
      {/* Ambient background glow */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-700",
          isError
            ? "bg-[radial-gradient(circle_400px_at_center,rgba(239,68,68,0.12),transparent_70%)]"
            : isReady
              ? "bg-[radial-gradient(circle_400px_at_center,rgba(16,185,129,0.12),transparent_70%)]"
              : "bg-[radial-gradient(circle_400px_at_center,rgba(59,130,246,0.1),transparent_70%)]"
        )}
      />

      {/* Floating Card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border/70 bg-card/95 p-7 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in zoom-in-95 duration-200 dark:bg-card/90">
        {/* Subtle glowing highlight edge */}
        <div
          className={cn(
            "absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent transition-colors duration-500",
            isError
              ? "via-destructive/60"
              : isReady
                ? "via-emerald-500/60"
                : "via-primary/50"
          )}
        />

        {/* Dismiss Button */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={dismissSandbox}
          className="absolute top-3.5 right-3.5 size-7 text-muted-foreground/60 hover:text-foreground cursor-pointer"
          title="Dismiss"
        >
          <XIcon className="size-4" />
        </Button>

        {/* Centerpiece Visual / Spinner */}
        <div className="relative mx-auto mb-4 flex size-20 items-center justify-center">
          {/* Ambient blur pulse */}
          <div
            className={cn(
              "absolute inset-0 rounded-full blur-xl opacity-60 transition-colors duration-500",
              isError
                ? "bg-destructive/30"
                : isReady
                  ? "bg-emerald-500/30"
                  : "bg-primary/25 animate-pulse"
            )}
          />

          {isLoading && (
            <>
              {/* Outer orbital spin ring */}
              <svg
                className="absolute inset-0 size-full animate-spin text-primary"
                viewBox="0 0 80 80"
                fill="none"
              >
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="45 180"
                  className="opacity-90"
                />
              </svg>

              {/* Inner counter-spinning orbital ring */}
              <svg
                className="absolute inset-2 size-16 animate-spin text-primary/35"
                style={{
                  animationDirection: "reverse",
                  animationDuration: "3.5s",
                }}
                viewBox="0 0 64 64"
                fill="none"
              >
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeDasharray="30 140"
                />
              </svg>
            </>
          )}

          {/* Central Icon Badge */}
          <div
            className={cn(
              "relative flex size-12 items-center justify-center rounded-xl border transition-all duration-300 shadow-inner",
              isError &&
                "size-14 rounded-full border-destructive/40 bg-destructive/10 shadow-destructive/20",
              isReady &&
                "size-14 rounded-full border-emerald-500/40 bg-emerald-500/10 shadow-emerald-500/20",
              isLoading && "border-primary/25 bg-primary/10"
            )}
          >
            {isError ? (
              <AlertTriangleIcon className="size-7 text-destructive animate-in zoom-in-75 duration-300" />
            ) : isReady ? (
              <CheckCircle2Icon className="size-7 text-emerald-500 animate-in zoom-in-75 duration-300" />
            ) : isResuming ? (
              <RefreshCwIcon className="size-6 text-primary animate-spin" />
            ) : isProvisioning ? (
              <BoxesIcon className="size-6 text-primary animate-pulse" />
            ) : (
              <CpuIcon className="size-6 text-primary animate-pulse" />
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="mb-2.5 flex items-center justify-center">
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 px-3 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors duration-300",
              isError &&
                "border-destructive/40 bg-destructive/10 text-destructive",
              isReady &&
                "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
              isLoading && "border-primary/30 bg-primary/5 text-primary"
            )}
          >
            {isLoading && (
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
            )}
            {isReady && (
              <span className="size-2 rounded-full bg-emerald-500" />
            )}
            {isError && (
              <span className="size-2 rounded-full bg-destructive" />
            )}
            {badgeLabel}
          </Badge>
        </div>

        {/* Heading */}
        <h3
          id="sandbox-overlay-title"
          className="text-center font-heading text-lg font-semibold tracking-tight text-foreground"
        >
          {displayTitle}
        </h3>

        {/* Message / Streamed Status */}
        <p className="mx-auto mt-1.5 min-h-[1.5rem] max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
          {displayMessage}
        </p>

        {/* Stage Stepper (When loading) */}
        {isLoading && (
          <div className="mt-6 border-t border-border/50 pt-4">
            <div className="flex items-center justify-between px-2">
              {STAGES.map((s, idx) => {
                const isCompleted = idx < stageIndex
                const isCurrent = idx === stageIndex
                return (
                  <div
                    key={s.id}
                    className="flex flex-1 items-center last:flex-none"
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full border text-[11px] font-medium transition-all duration-300",
                          isCompleted
                            ? "border-emerald-500 bg-emerald-500 text-white dark:text-black"
                            : isCurrent
                              ? "border-primary bg-primary/15 text-primary ring-2 ring-primary/20"
                              : "border-border/80 bg-muted/40 text-muted-foreground"
                        )}
                      >
                        {isCompleted ? (
                          <CheckIcon className="size-3.5 stroke-[2.5]" />
                        ) : (
                          <span>{idx + 1}</span>
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-medium tracking-tight whitespace-nowrap",
                          isCurrent
                            ? "text-foreground font-semibold"
                            : isCompleted
                              ? "text-muted-foreground"
                              : "text-muted-foreground/60"
                        )}
                      >
                        {s.label}
                      </span>
                    </div>

                    {idx < STAGES.length - 1 && (
                      <div
                        className={cn(
                          "mx-2 mb-4 h-0.5 flex-1 transition-colors duration-300",
                          idx < stageIndex
                            ? "bg-emerald-500"
                            : idx === stageIndex
                              ? "bg-primary/40"
                              : "bg-border/60"
                        )}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Error Details & Actions */}
        {isError && (
          <div className="mt-5 space-y-4">
            <div className="max-h-28 overflow-y-auto rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-left font-mono text-xs text-destructive select-text">
              {error || message}
              {details && (
                <div className="mt-1.5 border-t border-destructive/20 pt-1.5 text-[11px] text-muted-foreground">
                  {details}
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2.5">
              <Button
                onClick={() => void retrySandbox()}
                size="sm"
                className="cursor-pointer"
              >
                <RefreshCwIcon className="mr-1.5 size-3.5" />
                Retry startup
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={dismissSandbox}
                className="cursor-pointer"
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
