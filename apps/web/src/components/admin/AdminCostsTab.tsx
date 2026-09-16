import { useEffect, useState } from "react"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  CoinsIcon,
  CreditCardIcon,
  DollarSignIcon,
  RefreshCwIcon,
  SaveIcon,
  TrendingUpIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { getAdminCostAnalytics, updateAdminPlanBudgets } from "@/lib/api"
import { getApiErrorMessage } from "@/lib/http"
import type { AdminCostAnalytics, PlanBudgetConfig } from "@cloud-agent/shared"

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(2)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`
  return count.toLocaleString()
}

export function AdminCostsTab() {
  const [data, setData] = useState<AdminCostAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingBudgets, setSavingBudgets] = useState(false)

  const [budgetsForm, setBudgetsForm] = useState<PlanBudgetConfig>({
    free: 5.0,
    hacker: 20.0,
    pro: 50.0,
    soft_cap_percent: 80,
    enabled: true,
  })

  async function load(silent = false) {
    if (!silent) setLoading(true)
    try {
      const res = await getAdminCostAnalytics()
      setData(res)
      setBudgetsForm(res.plan_budgets)
    } catch (err) {
      if (!silent) {
        toast.error(getApiErrorMessage(err, "Failed to load cost analytics"))
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleSaveBudgets() {
    setSavingBudgets(true)
    try {
      const updated = await updateAdminPlanBudgets(budgetsForm)
      setBudgetsForm(updated)
      toast.success("Monthly plan budgets updated successfully")
      await load(true)
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update plan budgets"))
    } finally {
      setSavingBudgets(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const totalSpend = data?.total_spend_usd ?? 0.0
  const projectedSpend = data?.projected_spend_usd ?? 0.0
  const totalTokens = data?.total_tokens ?? 0
  const promptTokens = data?.total_prompt_tokens ?? 0
  const completionTokens = data?.total_completion_tokens ?? 0
  const activeUsers = data?.active_users_count ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Token Usage & Costs</h2>
          <p className="text-sm text-muted-foreground">
            Track LLM spend, enforce monthly user budgets ($), review spend by model, and monitor top spenders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs gap-1 py-1">
            <ClockIcon className="size-3 text-muted-foreground" />
            Period: {data?.current_period} ({data?.period_days_left}d left)
          </Badge>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCwIcon className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Global Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Month to Date Spend
            </CardTitle>
            <DollarSignIcon className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              ${totalSpend.toFixed(3)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Actual accrued API cost this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Projected Monthly Cost
            </CardTitle>
            <TrendingUpIcon className="size-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              ${projectedSpend.toFixed(2)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Estimated end-of-month bill
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Tokens Used
            </CardTitle>
            <CoinsIcon className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {formatTokens(totalTokens)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {formatTokens(promptTokens)} in • {formatTokens(completionTokens)} out
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Active Spenders
            </CardTitle>
            <UsersIcon className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {activeUsers}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Users who ran queries this billing cycle
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Plan Budget Caps Configuration Card */}
      <Card className="border-primary/20 bg-muted/20">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCardIcon className="size-4 text-primary" />
                Monthly Plan Budget Caps
              </CardTitle>
              <CardDescription className="text-xs">
                Enforce hard spending limits per user tier. When users reach 100% of their allowance, the agent politely pauses turns until the next month or plan upgrade.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="budget-enabled"
                checked={budgetsForm.enabled}
                onCheckedChange={(checked) =>
                  setBudgetsForm({ ...budgetsForm, enabled: checked })
                }
              />
              <Label htmlFor="budget-enabled" className="text-xs font-semibold cursor-pointer">
                {budgetsForm.enabled ? "Enforcement Active" : "Enforcement Disabled"}
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {/* Free Plan */}
            <div className="space-y-1.5">
              <Label htmlFor="budget-free" className="text-xs font-medium flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] px-1 py-0 uppercase">Free</Badge>
                Monthly Cap ($)
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-xs text-muted-foreground">$</span>
                <Input
                  id="budget-free"
                  type="number"
                  step="0.5"
                  min="0"
                  value={budgetsForm.free}
                  onChange={(e) =>
                    setBudgetsForm({ ...budgetsForm, free: parseFloat(e.target.value) || 0 })
                  }
                  className="pl-6 h-8 text-xs font-mono"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Standard free tier allowance</p>
            </div>

            {/* Hacker Plan */}
            <div className="space-y-1.5">
              <Label htmlFor="budget-hacker" className="text-xs font-medium flex items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px] px-1 py-0 uppercase">Hacker</Badge>
                Monthly Cap ($)
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-xs text-muted-foreground">$</span>
                <Input
                  id="budget-hacker"
                  type="number"
                  step="1.0"
                  min="0"
                  value={budgetsForm.hacker}
                  onChange={(e) =>
                    setBudgetsForm({ ...budgetsForm, hacker: parseFloat(e.target.value) || 0 })
                  }
                  className="pl-6 h-8 text-xs font-mono"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Mid-tier active developers</p>
            </div>

            {/* Pro Plan */}
            <div className="space-y-1.5">
              <Label htmlFor="budget-pro" className="text-xs font-medium flex items-center gap-1.5">
                <Badge variant="default" className="text-[10px] px-1 py-0 uppercase">Pro</Badge>
                Monthly Cap ($)
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-xs text-muted-foreground">$</span>
                <Input
                  id="budget-pro"
                  type="number"
                  step="5.0"
                  min="0"
                  value={budgetsForm.pro}
                  onChange={(e) =>
                    setBudgetsForm({ ...budgetsForm, pro: parseFloat(e.target.value) || 0 })
                  }
                  className="pl-6 h-8 text-xs font-mono"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Power users & enterprise</p>
            </div>

            {/* Soft Cap Alert */}
            <div className="space-y-1.5">
              <Label htmlFor="budget-soft-cap" className="text-xs font-medium flex items-center gap-1.5">
                <AlertTriangleIcon className="size-3 text-amber-500" />
                Soft Warning Alert (%)
              </Label>
              <Input
                id="budget-soft-cap"
                type="number"
                step="5"
                min="10"
                max="100"
                value={budgetsForm.soft_cap_percent}
                onChange={(e) =>
                  setBudgetsForm({
                    ...budgetsForm,
                    soft_cap_percent: parseInt(e.target.value) || 80,
                  })
                }
                className="h-8 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">Warns user in chat before blocking</p>
            </div>
          </div>

          <div className="flex items-center justify-end pt-2 border-t">
            <Button size="sm" onClick={handleSaveBudgets} disabled={savingBudgets}>
              {savingBudgets ? <Spinner className="size-3.5" /> : <SaveIcon className="size-3.5" />}
              Save Plan Budgets
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Spend by Model & Top Spenders */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Spend by Model */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ZapIcon className="size-4 text-amber-500" />
              Spend by Model
            </CardTitle>
            <CardDescription className="text-xs">
              Distribution of cost across active models
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(!data?.spend_by_model || data.spend_by_model.length === 0) ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No model usage recorded this month yet.
              </div>
            ) : (
              data.spend_by_model.map((m) => {
                const percent = totalSpend > 0 ? (m.cost_usd / totalSpend) * 100 : 0
                return (
                  <div key={m.model_id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold">{m.model_id}</span>
                        <span className="text-muted-foreground text-[10px] ml-1.5">
                          ({m.provider})
                        </span>
                      </div>
                      <span className="font-mono font-bold">${m.cost_usd.toFixed(3)}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{formatTokens(m.total_tokens)} tokens</span>
                      <span>{percent.toFixed(1)}% of total spend</span>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Top Spenders Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UsersIcon className="size-4 text-primary" />
              Top Spenders & Budget Consumption
            </CardTitle>
            <CardDescription className="text-xs">
              Users ranked by API token expenditure in the current billing cycle
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {(!data?.top_users || data.top_users.length === 0) ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No user spending recorded this month yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/40 font-medium text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Tokens</th>
                      <th className="px-4 py-3">Spend / Budget</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.top_users.map((u) => {
                      const isOver = u.percent_used >= 100
                      const isWarning = u.percent_used >= (data?.plan_budgets.soft_cap_percent ?? 80)
                      return (
                        <tr key={u.user_id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">{u.name}</div>
                            <div className="text-[11px] text-muted-foreground">{u.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {u.plan}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">
                            {formatTokens(u.total_tokens)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1 min-w-[130px]">
                              <div className="flex justify-between font-mono text-[11px]">
                                <span className="font-semibold">${u.estimated_cost_usd.toFixed(2)}</span>
                                <span className="text-muted-foreground">
                                  {u.role === "admin" ? "Unlimited" : `$${u.budget_usd.toFixed(2)}`}
                                </span>
                              </div>
                              {u.role !== "admin" && (
                                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      isOver
                                        ? "bg-destructive"
                                        : isWarning
                                        ? "bg-amber-500"
                                        : "bg-emerald-500"
                                    }`}
                                    style={{ width: `${Math.min(100, u.percent_used)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {u.role === "admin" ? (
                              <Badge variant="secondary" className="text-[10px]">Exempt</Badge>
                            ) : isOver ? (
                              <Badge variant="destructive" className="text-[10px] gap-1">
                                <AlertTriangleIcon className="size-3" />
                                Capped
                              </Badge>
                            ) : isWarning ? (
                              <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1">
                                <AlertTriangleIcon className="size-3" />
                                {u.percent_used}%
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1">
                                <CheckCircle2Icon className="size-3" />
                                Normal
                              </Badge>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
