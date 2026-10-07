import { useState, useMemo } from "react"
import {
  CheckCircle2Icon,
  CircleIcon,
  ChevronDownIcon,
  PlayIcon,
  ListTodoIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export type PlanStep = {
  id: string
  index: number
  title: string
  description?: string
  status: "pending" | "in_progress" | "completed"
}

export type ParsedPlan = {
  headerTitle: string
  steps: PlanStep[]
  completedCount: number
  totalCount: number
  percent: number
  allCompleted: boolean
}

/**
 * Parses markdown task lists (- [ ], - [x], - [/]) under a Plan header or checklist block.
 */
export function extractPlanFromMarkdown(content: string): ParsedPlan | null {
  if (!content) return null

  // Check for task list items: - [ ] or - [x] or - [/]
  const taskRegex = /^[-*]\s+\[([ xX/])\]\s+(.+)$/gm
  const matches: { check: string; text: string }[] = []

  let match: RegExpExecArray | null
  while ((match = taskRegex.exec(content)) !== null) {
    matches.push({ check: match[1], text: match[2].trim() })
  }

  if (matches.length < 2) {
    return null
  }

  const steps: PlanStep[] = matches.map((m, i) => {
    let status: PlanStep["status"] = "pending"
    if (m.check === "x" || m.check === "X") {
      status = "completed"
    } else if (m.check === "/") {
      status = "in_progress"
    }

    // Split title and optional description by colon or dash if present
    let title = m.text
    let description: string | undefined = undefined

    const colonIdx = m.text.indexOf(":")
    if (colonIdx > 0 && colonIdx < 60) {
      title = m.text.slice(0, colonIdx).trim()
      description = m.text.slice(colonIdx + 1).trim()
    }

    return {
      id: `step-${i}`,
      index: i + 1,
      title,
      description,
      status,
    }
  })

  const completedCount = steps.filter((s) => s.status === "completed").length
  const totalCount = steps.length
  const percent = Math.round((completedCount / totalCount) * 100)

  // Extract custom header title if present (e.g. ### Plan or ### Execution Plan)
  let headerTitle = "Execution Plan"
  const headerMatch = content.match(/#{1,4}\s+([^\n]*(?:Plan|Roadmap|Steps)[^\n]*)/i)
  if (headerMatch && headerMatch[1]) {
    headerTitle = headerMatch[1].trim()
  }

  return {
    headerTitle,
    steps,
    completedCount,
    totalCount,
    percent,
    allCompleted: completedCount === totalCount,
  }
}

/**
 * Strips the markdown checklist block if rendered in the interactive card.
 */
export function stripPlanFromMarkdown(content: string): string {
  if (!content) return ""
  // Strip task list lines and trailing empty lines
  const cleaned = content.replace(/^[-*]\s+\[([ xX/])\]\s+.*(?:\r?\n)?/gm, "")
  // Clean up any empty Plan headers that have no body left
  return cleaned.replace(/#{1,4}\s+[^\n]*(?:Plan|Roadmap|Steps)[^\n]*(?:\r?\n)+/gi, "\n").trim()
}

/**
 * Returns true if the content contains a parseable execution plan checklist.
 */
export function hasPlanBlock(content?: string): boolean {
  if (!content) return false
  return extractPlanFromMarkdown(content) !== null
}

type ExecutionPlanCardProps = {
  content: string
  isStreaming?: boolean
  mode?: "build" | "plan"
  onExecutePlan?: (planSummary: string) => void
  className?: string
}

export function ExecutionPlanCard({
  content,
  isStreaming = false,
  mode,
  onExecutePlan,
  className,
}: ExecutionPlanCardProps) {
  const initialPlan = useMemo(() => extractPlanFromMarkdown(content), [content])
  const [collapsed, setCollapsed] = useState(false)
  const [localOverrides, setLocalOverrides] = useState<Record<string, PlanStep["status"]>>({})

  if (!initialPlan) return null

  // Merge parser steps with any manual user checkbox clicks
  const steps = initialPlan.steps.map((step) => {
    if (localOverrides[step.id]) {
      return { ...step, status: localOverrides[step.id] }
    }
    return step
  })

  const completedCount = steps.filter((s) => s.status === "completed").length
  const totalCount = steps.length
  const percent = Math.round((completedCount / totalCount) * 100)
  const allCompleted = completedCount === totalCount

  const toggleStep = (stepId: string) => {
    setLocalOverrides((prev) => {
      const current = prev[stepId] || steps.find((s) => s.id === stepId)?.status || "pending"
      const next = current === "completed" ? "pending" : "completed"
      return { ...prev, [stepId]: next }
    })
  }

  const handleExecute = () => {
    if (!onExecutePlan) return
    const planSummary = steps
      .map((s) => `- [ ] ${s.title}${s.description ? `: ${s.description}` : ""}`)
      .join("\n")
    onExecutePlan(planSummary)
  }

  return (
    <div
      className={cn(
        "my-3 w-full max-w-2xl overflow-hidden rounded-lg border border-border/70 bg-card/60 shadow-xs backdrop-blur-xs transition-all",
        className
      )}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border/50 px-3.5 py-2.5 bg-muted/20">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            {allCompleted ? (
              <CheckCircle2Icon className="size-3.5" />
            ) : isStreaming ? (
              <Spinner className="size-3.5" />
            ) : (
              <ListTodoIcon className="size-3.5" />
            )}
          </div>
          <span className="truncate text-xs font-medium tracking-tight text-foreground">
            {initialPlan.headerTitle}
          </span>
          {mode === "plan" && (
            <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase text-sky-600 dark:text-sky-400">
              Plan Mode
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {completedCount}/{totalCount} ({percent}%)
          </span>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
            title={collapsed ? "Expand plan" : "Collapse plan"}
          >
            <ChevronDownIcon
              className={cn("size-3.5 transition-transform duration-200", collapsed && "-rotate-90")}
            />
          </button>
        </div>
      </div>

      {/* Slim progress bar track */}
      <div className="h-1 w-full bg-muted/50 overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-300",
            allCompleted ? "bg-emerald-500" : "bg-primary"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Step list body */}
      {!collapsed && (
        <div className="flex flex-col gap-1 p-2.5">
          {steps.map((step, idx) => {
            const isDone = step.status === "completed"
            const isInProgress = step.status === "in_progress" || (isStreaming && !isDone && idx === completedCount)

            return (
              <div
                key={step.id}
                onClick={() => toggleStep(step.id)}
                className={cn(
                  "group flex items-start gap-2.5 rounded-md p-1.5 text-xs transition-colors cursor-pointer hover:bg-muted/40",
                  isDone && "text-muted-foreground"
                )}
              >
                <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                  {isDone ? (
                    <CheckCircle2Icon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : isInProgress ? (
                    <Spinner className="size-3.5 text-primary" />
                  ) : (
                    <CircleIcon className="size-3 text-muted-foreground/40 group-hover:text-muted-foreground" />
                  )}
                </div>

                <div className="min-w-0 flex-1 leading-relaxed">
                  <span
                    className={cn(
                      "font-medium",
                      isDone && "line-through opacity-75 text-muted-foreground",
                      isInProgress && "text-foreground font-semibold"
                    )}
                  >
                    {step.title}
                  </span>
                  {step.description && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground/80 leading-normal">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            )
          })}

          {/* Action handoff button for Plan Mode */}
          {mode === "plan" && !allCompleted && !isStreaming && onExecutePlan && (
            <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                Ready to implement this plan?
              </span>
              <Button
                type="button"
                size="xs"
                variant="default"
                onClick={handleExecute}
                className="gap-1.5 px-3 font-medium shadow-xs"
              >
                <PlayIcon className="size-3 fill-current" />
                Execute Plan
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
