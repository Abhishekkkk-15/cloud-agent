import { useState } from "react"
import {
  BookOpenIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  FilePenLineIcon,
  FilePlus2Icon,
  GitBranchIcon,
  TerminalIcon,
  WrenchIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import type { ToolCall } from "@/types/agent"

function getToolIcon(name: string) {
  if (name.includes("read")) return BookOpenIcon
  if (name.includes("write") || name.includes("create")) return FilePlus2Icon
  if (name.includes("edit") || name.includes("modify")) return FilePenLineIcon
  if (name.includes("run") || name.includes("bash") || name.includes("command")) return TerminalIcon
  if (name.includes("git")) return GitBranchIcon
  return WrenchIcon
}

export function ToolCallCard({ tool }: { tool: ToolCall }) {
  const [open, setOpen] = useState(tool.status === "failed")
  const Icon = getToolIcon(tool.name)

  const isRunning = tool.status === "running"
  const isFailed = tool.status === "failed"
  const isCompleted = tool.status === "completed"
  const isNeedsApproval = tool.status === "needs_approval"

  return (
    <div className="w-full my-1.5 overflow-hidden rounded-md border bg-card/60 text-xs">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/40 transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
              <Icon className="size-3" />
            </span>
            <span className="font-mono text-[11px] font-medium text-foreground truncate">
              {tool.description || tool.name}
            </span>
            {tool.diff?.stats && (
              <span className="flex items-center gap-1 font-mono text-[10px]">
                <span className="text-emerald-500">+{tool.diff.stats.additions}</span>
                <span className="text-rose-500">-{tool.diff.stats.deletions}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isRunning && (
              <Badge variant="secondary" className="h-4 gap-1 px-1.5 text-[10px] text-amber-500 font-normal">
                <Spinner className="size-2.5" />
                <span>Running</span>
              </Badge>
            )}
            {isCompleted && (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                Completed
              </Badge>
            )}
            {isNeedsApproval && (
              <Badge variant="destructive" className="h-4 px-1.5 text-[10px] font-normal bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                Approval Required
              </Badge>
            )}
            {isFailed && (
              <Badge variant="destructive" className="h-4 px-1.5 text-[10px] font-normal">
                Failed
              </Badge>
            )}

            {tool.executionTimeMs !== undefined && tool.executionTimeMs > 0 && (
              <span className="text-[10px] font-mono text-muted-foreground/60 hidden sm:inline">
                {tool.executionTimeMs}ms
              </span>
            )}

            <ChevronDownIcon
              className={cn(
                "size-3 text-muted-foreground transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </div>
        </div>

        <CollapsibleContent>
          <div className="border-t bg-muted/30 p-2.5 space-y-2 text-[11px] font-mono">
            {/* Tool Arguments */}
            {tool.args && Object.keys(tool.args).length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Parameters</span>
                <div className="rounded bg-muted/60 p-2 overflow-x-auto text-foreground/80">
                  {Object.entries(tool.args).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-muted-foreground">{k}:</span>
                      <span>{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Output or Error */}
            {tool.output && (
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Output</span>
                <pre className="rounded bg-muted/60 p-2 overflow-x-auto text-foreground/80 whitespace-pre-wrap max-h-48">
                  {tool.output}
                </pre>
              </div>
            )}

            {tool.error && (
              <div className="space-y-1">
                <span className="text-[10px] text-rose-500 uppercase font-semibold flex items-center gap-1">
                  <CircleAlertIcon className="size-3" />
                  Error
                </span>
                <pre className="rounded bg-rose-500/10 border border-rose-500/20 p-2 overflow-x-auto text-rose-500 whitespace-pre-wrap">
                  {tool.error}
                </pre>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
