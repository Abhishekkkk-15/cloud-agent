import { useWorkspaceStore } from "@/stores/workspace-store"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { GaugeIcon } from "lucide-react"

function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`
  }
  if (count >= 1_000) {
    const val = count / 1_000
    return `${val >= 10 ? Math.round(val) : val.toFixed(1)}k`
  }
  return count.toString()
}

export function ContextUsageIndicator() {
  const contextUsage = useWorkspaceStore((s) => s.contextUsage)

  const filled = contextUsage?.filled_tokens ?? 0
  const total = contextUsage?.total_tokens || 128_000
  const remaining = Math.max(0, total - filled)
  const percent = contextUsage?.percent_used ?? (total > 0 ? Number(((filled / total) * 100).toFixed(1)) : 0)
  const isCompacting = Boolean(contextUsage?.compact_at_tokens)
  const modelLimit = contextUsage?.model_limit

  // Determine status color
  let colorClass = "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
  let ringColor = "stroke-emerald-500"
  let barColor = "bg-emerald-500"

  if (percent >= 85) {
    colorClass = "text-rose-600 dark:text-rose-400 border-rose-500/30 bg-rose-500/10"
    ringColor = "stroke-rose-500"
    barColor = "bg-rose-500"
  } else if (percent >= 60) {
    colorClass = "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10"
    ringColor = "stroke-amber-500"
    barColor = "bg-amber-500"
  }

  // Circular progress math
  const radius = 6
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference

  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger
          type="button"
          className={`group flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium tracking-tight transition-colors cursor-pointer select-none ${colorClass}`}
        >
          {/* Mini progress circle */}
          <div className="relative size-3.5 flex items-center justify-center shrink-0">
            <svg className="size-3.5 -rotate-90" viewBox="0 0 16 16">
              <circle
                cx="8"
                cy="8"
                r={radius}
                className="stroke-muted/40 fill-none"
                strokeWidth="2.5"
              />
              <circle
                cx="8"
                cy="8"
                r={radius}
                className={`${ringColor} fill-none transition-all duration-300`}
                strokeWidth="2.5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
          </div>

          <span className="font-mono">{formatTokens(filled)}</span>
          <span className="text-muted-foreground/60 font-mono">/ {formatTokens(total)}</span>
        </TooltipTrigger>

        <TooltipContent
          side="top"
          align="start"
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
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
