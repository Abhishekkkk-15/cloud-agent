import { useState } from "react"
import { useWorkspaceStore } from "@/stores/workspace-store"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { BarChart3Icon, GaugeIcon } from "lucide-react"
import { SessionAnalyticsDialog } from "@/components/workspace/SessionAnalyticsDialog"

export function ContextUsageIndicator() {
  const contextUsage = useWorkspaceStore((s) => s.contextUsage)
  const [open, setOpen] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)

  const filled = contextUsage?.filled_tokens ?? 0
  const total = contextUsage?.total_tokens || 128_000
  const remaining = Math.max(0, total - filled)
  const percent = contextUsage?.percent_used ?? (total > 0 ? Number(((filled / total) * 100).toFixed(1)) : 0)
  const isCompacting = Boolean(contextUsage?.compact_at_tokens)
  const modelLimit = contextUsage?.model_limit

  // Determine status color
  let ringColor = "stroke-foreground/80 dark:stroke-white/90"
  let barColor = "bg-primary"

  if (percent >= 85) {
    ringColor = "stroke-rose-500"
    barColor = "bg-rose-500"
  } else if (percent >= 60) {
    ringColor = "stroke-amber-500"
    barColor = "bg-amber-500"
  }

  // Circular progress math (viewBox 20x20, r=7)
  const radius = 7
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset =
    circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference

  return (
    <>
      <TooltipProvider delay={150}>
        <Tooltip open={open} onOpenChange={setOpen}>
          <TooltipTrigger
            type="button"
            aria-label={`Context usage: ${percent.toFixed(1)}%`}
            onClick={() => setOpen((v) => !v)}
            className="group relative flex size-6 items-center justify-center rounded-full bg-transparent text-muted-foreground outline-none transition-transform hover:scale-110 hover:text-foreground cursor-pointer select-none"
          >
            {/* Circular progress ring */}
            <svg className="size-4 -rotate-90" viewBox="0 0 20 20">
              {/* Background ring track */}
              <circle
                cx="10"
                cy="10"
                r={radius}
                className="stroke-muted-foreground/20 dark:stroke-white/15 fill-none"
                strokeWidth="2.2"
              />
              {/* Active filled arc */}
              <circle
                cx="10"
                cy="10"
                r={radius}
                className={`${ringColor} fill-none transition-all duration-500 ease-out`}
                strokeWidth="2.2"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
          </TooltipTrigger>

          <TooltipContent
            side="top"
            align="end"
            className="p-3 w-64 text-left shadow-lg rounded-lg border bg-popover text-popover-foreground"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 border-b pb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <GaugeIcon className="size-3.5 text-primary" />
                  <span>{isCompacting ? "Context Compaction" : "Context Window"}</span>
                </div>
                <span className="text-xs font-mono font-medium">
                  {percent.toFixed(1)}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                  style={{ width: `${Math.min(100, Math.max(1, percent))}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                <span className="text-muted-foreground">Filled Tokens:</span>
                <span className="font-mono text-right font-medium">{filled.toLocaleString()}</span>

                <span className="text-muted-foreground">{isCompacting ? "Compacts At:" : "Context Limit:"}</span>
                <span className="font-mono text-right">{total.toLocaleString()}</span>

                <span className="text-muted-foreground">{isCompacting ? "Room to Compact:" : "Available Room:"}</span>
                <span className="font-mono text-right text-emerald-600 dark:text-emerald-400">
                  {remaining.toLocaleString()}
                </span>

                {isCompacting && modelLimit ? (
                  <>
                    <span className="text-muted-foreground">Model Context Limit:</span>
                    <span className="font-mono text-right text-muted-foreground/80">
                      {modelLimit.toLocaleString()}
                    </span>
                  </>
                ) : null}
              </div>

              <p className="text-[10px] text-muted-foreground/75 leading-tight pt-1 border-t">
                {isCompacting
                  ? "History automatically compacts when active context reaches the compaction threshold."
                  : "Shows active context sent to the LLM (system prompt, working memory & active conversation turns)."}
              </p>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen(false)
                  setShowAnalytics(true)
                }}
                className="w-full mt-1.5 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium transition-colors cursor-pointer"
              >
                <BarChart3Icon className="size-3.5" />
                <span>Token & Tool Analytics</span>
              </button>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <SessionAnalyticsDialog
        open={showAnalytics}
        onOpenChange={setShowAnalytics}
      />
    </>
  )
}
