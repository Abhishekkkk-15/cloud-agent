import { useEffect, useState } from "react"
import {
  ActivityIcon,
  AlertCircleIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  Code2Icon,
  CopyIcon,
  FileCode2Icon,
  LayersIcon,
  SearchIcon,
  TerminalIcon,
  WrenchIcon,
  XCircleIcon,
  CoinsIcon,
} from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  getSessionAnalytics,
  type SessionAnalyticsResponse,
} from "@/lib/api"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { toast } from "sonner"

type SessionAnalyticsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId?: string | null
}

export function SessionAnalyticsDialog({
  open,
  onOpenChange,
  sessionId,
}: SessionAnalyticsDialogProps) {
  const storeSessionId = useWorkspaceStore((s) => s.activeSessionId)
  const activeSessionId = sessionId || storeSessionId
  const selectedModel = useWorkspaceStore((s) => s.selectedModel)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SessionAnalyticsResponse | null>(null)
  const [filterMode, setFilterMode] = useState<"all" | "errors">("all")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (!open || !activeSessionId) return
    setLoading(true)
    getSessionAnalytics(activeSessionId, selectedModel)
      .then((res) => {
        setData(res)
      })
      .catch((err) => {
        toast.error("Failed to load session analytics", {
          description: err instanceof Error ? err.message : String(err),
        })
      })
      .finally(() => {
        setLoading(false)
      })
  }, [open, activeSessionId, selectedModel])

  const copyToClipboard = (text: string, label: string) => {
    void navigator.clipboard.writeText(text)
    toast.success(`Copied ${label} to clipboard`)
  }

  const filteredExecutions = (data?.tool_executions ?? []).filter((exec) => {
    if (filterMode === "errors" && exec.status !== "error") return false
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      exec.tool_name.toLowerCase().includes(q) ||
      (exec.error_reason && exec.error_reason.toLowerCase().includes(q)) ||
      (exec.output_preview && exec.output_preview.toLowerCase().includes(q))
    )
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 p-0 overflow-hidden w-[95vw] sm:max-w-4xl md:max-w-5xl h-[88vh] max-h-[850px] rounded-xl border bg-card shadow-2xl">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b bg-muted/20 shrink-0">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                <BarChart3Icon className="size-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight truncate">
                  Session Token & Activity Analytics
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground truncate font-mono">
                  {data?.session.title || "Current Session"} · ID: {activeSessionId}
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
            <Spinner className="size-7 text-primary" />
            <p className="text-xs text-muted-foreground">
              Analyzing token usage, prompt footprint, and tool logs…
            </p>
          </div>
        ) : !data ? (
          <div className="flex-1 flex items-center justify-center py-12 text-sm text-muted-foreground">
            No analytics data available for this session.
          </div>
        ) : (
          <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
            {/* Tab navigation bar */}
            <div className="px-4 sm:px-6 pt-3 pb-2 border-b bg-background/50 shrink-0">
              <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto p-1 gap-1">
                <TabsTrigger value="overview" className="text-xs py-1.5 gap-1.5">
                  <CoinsIcon className="size-3.5" />
                  <span>Overview</span>
                </TabsTrigger>
                <TabsTrigger value="system-prompt" className="text-xs py-1.5 gap-1.5">
                  <FileCode2Icon className="size-3.5" />
                  <span>System Prompt</span>
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 ml-1 hidden sm:inline-flex">
                    ~{data.system_prompt.estimated_tokens.toLocaleString()} tok
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="tool-summary" className="text-xs py-1.5 gap-1.5">
                  <WrenchIcon className="size-3.5" />
                  <span>Tools ({data.tools_summary.total_calls})</span>
                </TabsTrigger>
                <TabsTrigger value="tool-logs" className="text-xs py-1.5 gap-1.5">
                  <TerminalIcon className="size-3.5" />
                  <span>Logs</span>
                  {data.tools_summary.total_failure > 0 ? (
                    <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4 ml-1">
                      {data.tools_summary.total_failure} err
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 ml-1 hidden sm:inline-flex">
                      {data.tool_executions.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB 1: OVERVIEW & TOKEN USAGE */}
            <TabsContent value="overview" className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 data-[state=inactive]:hidden">
              {/* Key Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border bg-card/60 flex flex-col gap-1 shadow-xs">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Total Tokens (Cumulative)
                  </span>
                  <span className="text-xl font-bold font-mono text-primary">
                    {data.session.total_tokens.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {data.session.total_messages} messages across all turns
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border bg-card/60 flex flex-col gap-1 shadow-xs">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Prompt / Input Tokens
                  </span>
                  <span className="text-xl font-bold font-mono">
                    {data.session.prompt_tokens.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Cached: {data.session.cached_tokens.toLocaleString()}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border bg-card/60 flex flex-col gap-1 shadow-xs">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Completion / Output
                  </span>
                  <span className="text-xl font-bold font-mono">
                    {data.session.completion_tokens.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Generated by LLM
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border bg-card/60 flex flex-col gap-1 shadow-xs">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Estimated Spend
                  </span>
                  <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    ${data.session.estimated_cost_usd.toFixed(4)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Based on model token pricing
                  </span>
                </div>
              </div>

              {/* Compaction & System Prompt Callouts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <LayersIcon className="size-3.5 text-primary" />
                      Context Compaction Status
                    </span>
                    {data.session.has_compaction ? (
                      <Badge variant="default" className="text-[10px] bg-emerald-600">
                        Compacted
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Not Compacted Yet
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {data.session.has_compaction
                      ? `History compacted up to message ${data.session.compacted_until}. Preserves recent turns while summarizing older context (${data.session.compaction_summary_length} summary chars).`
                      : `Active context has not yet reached the compaction threshold. The model receives all messages in the working window on every turn.`}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold flex items-center gap-1.5">
                      <Code2Icon className="size-3.5 text-primary" />
                      System Prompt Overhead
                    </span>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      ~{data.system_prompt.estimated_tokens.toLocaleString()} tokens
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The base system prompt, tool definitions, and skill snippets account for{" "}
                    <strong>{data.system_prompt.char_count.toLocaleString()} characters</strong> (~{data.system_prompt.estimated_tokens.toLocaleString()} tokens) prepended to every LLM turn.
                  </p>
                </div>
              </div>

              {/* Context Growth Timeline Sample */}
              <div className="p-3.5 rounded-xl border bg-card/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1.5">
                    <ActivityIcon className="size-3.5 text-primary" />
                    Working Context Accumulation
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Total messages: {data.session.total_messages}
                  </span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {data.timeline_progression.slice(-15).map((step) => (
                    <div
                      key={step.seq}
                      className="flex items-center justify-between text-[11px] p-2 rounded bg-muted/40 font-mono"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-muted-foreground w-14 shrink-0">Seq #{step.seq}</span>
                        <Badge
                          variant={step.role === "assistant" ? "secondary" : step.role === "tool" ? "outline" : "default"}
                          className="text-[9px] px-1.5 py-0 h-4 uppercase shrink-0"
                        >
                          {step.name ? `${step.role}:${step.name}` : step.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-muted-foreground">+{step.estimated_tokens} tok</span>
                        <span className="font-semibold text-foreground w-24 text-right">
                          ~{step.working_context_tokens.toLocaleString()} total
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: SYSTEM PROMPT VIEWER */}
            <TabsContent value="system-prompt" className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-3 data-[state=inactive]:hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {data.system_prompt.estimated_tokens.toLocaleString()} Estimated Tokens
                  </Badge>
                  <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                    {data.system_prompt.char_count.toLocaleString()} Characters
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5 cursor-pointer"
                  onClick={() => copyToClipboard(data.system_prompt.content, "System Prompt")}
                >
                  <CopyIcon className="size-3.5" />
                  Copy System Prompt
                </Button>
              </div>

              <div className="rounded-xl border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[52vh] whitespace-pre-wrap select-text">
                {data.system_prompt.content || "No system prompt recorded for this session."}
              </div>
            </TabsContent>

            {/* TAB 3: TOOL BREAKDOWN TABLE */}
            <TabsContent value="tool-summary" className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 data-[state=inactive]:hidden">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border bg-card/60 flex flex-col">
                  <span className="text-[11px] text-muted-foreground">Total Tool Calls</span>
                  <span className="text-xl font-bold font-mono">{data.tools_summary.total_calls}</span>
                </div>
                <div className="p-3.5 rounded-xl border bg-card/60 flex flex-col">
                  <span className="text-[11px] text-muted-foreground">Successful Executions</span>
                  <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {data.tools_summary.total_success}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl border bg-card/60 flex flex-col">
                  <span className="text-[11px] text-muted-foreground">Failures / Errors</span>
                  <span className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
                    {data.tools_summary.total_failure} ({data.tools_summary.failure_rate_percent}%)
                  </span>
                </div>
              </div>

              <div className="rounded-xl border overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[550px]">
                  <thead className="bg-muted/50 border-b text-[11px] font-semibold text-muted-foreground uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Tool Name</th>
                      <th className="py-2.5 px-3 text-right">Total Calls</th>
                      <th className="py-2.5 px-3 text-right">Success</th>
                      <th className="py-2.5 px-3 text-right">Failed</th>
                      <th className="py-2.5 px-3 text-right">Output Chars</th>
                      <th className="py-2.5 px-3 text-right">Est. Output Tokens</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono">
                    {data.tools_breakdown.map((t) => (
                      <tr key={t.name} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-1.5">
                          <WrenchIcon className="size-3 text-primary shrink-0" />
                          <span>{t.name}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold">{t.call_count}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">
                          {t.success_count}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {t.failure_count > 0 ? (
                            <span className="text-rose-600 dark:text-rose-400 font-bold">
                              {t.failure_count}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground">
                          {t.total_output_chars.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground">
                          ~{t.estimated_output_tokens.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* TAB 4: TOOL EXECUTIONS & ERRORS AUDIT LOG */}
            <TabsContent value="tool-logs" className="flex-1 min-h-0 flex flex-col p-4 sm:p-6 space-y-3 data-[state=inactive]:hidden">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={filterMode === "all" ? "default" : "outline"}
                    className="h-8 text-xs cursor-pointer"
                    onClick={() => setFilterMode("all")}
                  >
                    All Executions ({data.tool_executions.length})
                  </Button>
                  <Button
                    size="sm"
                    variant={filterMode === "errors" ? "destructive" : "outline"}
                    className="h-8 text-xs gap-1 cursor-pointer"
                    onClick={() => setFilterMode("errors")}
                  >
                    <AlertCircleIcon className="size-3" />
                    Failures Only ({data.tools_summary.total_failure})
                  </Button>
                </div>

                <div className="relative w-full sm:w-64">
                  <SearchIcon className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search tool, arguments, error..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 text-xs pl-8"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
                {filteredExecutions.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    No tool executions match the current filter.
                  </div>
                ) : (
                  filteredExecutions.map((exec) => (
                    <div
                      key={`${exec.seq}-${exec.tool_name}`}
                      className={`p-3.5 rounded-xl border text-xs space-y-2 transition-colors ${
                        exec.status === "error"
                          ? "border-rose-500/40 bg-rose-500/5 dark:bg-rose-950/15"
                          : "border-border bg-card/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={exec.status === "error" ? "destructive" : "secondary"}
                            className="text-[10px] font-mono px-1.5 py-0.5 gap-1"
                          >
                            {exec.status === "error" ? (
                              <XCircleIcon className="size-3" />
                            ) : (
                              <CheckCircle2Icon className="size-3 text-emerald-500" />
                            )}
                            {exec.tool_name}
                          </Badge>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            Seq #{exec.seq}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {exec.char_count.toLocaleString()} chars (~{exec.estimated_tokens} tok)
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
                            onClick={() => copyToClipboard(exec.full_output, `Seq #${exec.seq} Output`)}
                            title="Copy Full Output"
                          >
                            <CopyIcon className="size-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Error Banner if Failed */}
                      {exec.status === "error" && exec.error_reason && (
                        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] font-mono text-rose-700 dark:text-rose-300">
                          <strong>Failure Reason:</strong> {exec.error_reason}
                        </div>
                      )}

                      {/* Arguments if available */}
                      {exec.arguments != null ? (
                        <div className="text-[11px] font-mono text-muted-foreground/90 bg-muted/40 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                          <span className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
                            Arguments:
                          </span>
                          {typeof exec.arguments === "string"
                            ? exec.arguments
                            : JSON.stringify(exec.arguments, null, 2)}
                        </div>
                      ) : null}

                      {/* Output Preview */}
                      <div className="text-[11px] font-mono bg-background/80 p-2 rounded border border-border/50 max-h-36 overflow-y-auto whitespace-pre-wrap select-text">
                        {exec.full_output || "[No output returned]"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
