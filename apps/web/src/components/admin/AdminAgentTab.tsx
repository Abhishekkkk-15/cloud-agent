import { useEffect, useState } from "react"
import {
  CheckCircle2Icon,
  CpuIcon,
  FileTextIcon,
  HardDriveIcon,
  LockIcon,
  RefreshCwIcon,
  SaveIcon,
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
import { Textarea } from "@/components/ui/textarea"
import {
  getAdminAgentConfig,
  getAllModels,
  updateAdminAgentConfig,
} from "@/lib/api"
import { getApiErrorMessage } from "@/lib/http"
import type { AdminAgentConfig, LLMModel } from "@cloud-agent/shared"

export function AdminAgentTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [models, setModels] = useState<LLMModel[]>([])

  const [form, setForm] = useState<AdminAgentConfig>({
    default_model_id: null,
    default_effort: "high",
    autonomous_mode: true,
    max_retries: 3,
    compaction_enabled: true,
    compact_at_tokens: 20000,
    keep_recent_tokens: 6000,
    system_prompt_prefix: null,
  })

  async function loadData(silent = false) {
    if (!silent) setLoading(true)
    try {
      const [configData, modelsData] = await Promise.all([
        getAdminAgentConfig(),
        getAllModels(),
      ])
      setForm(configData)
      setModels(modelsData)
    } catch (err) {
      if (!silent) {
        toast.error(getApiErrorMessage(err, "Failed to load agent configuration"))
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateAdminAgentConfig({
        default_model_id: form.default_model_id || null,
        default_effort: form.default_effort,
        autonomous_mode: form.autonomous_mode,
        max_retries: Number(form.max_retries),
        compaction_enabled: form.compaction_enabled,
        compact_at_tokens: Number(form.compact_at_tokens),
        keep_recent_tokens: Number(form.keep_recent_tokens),
        system_prompt_prefix: form.system_prompt_prefix?.trim() || null,
      })
      setForm(updated)
      toast.success("Agent configuration updated successfully")
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update agent configuration"))
    } finally {
      setSaving(false)
    }
  }

  const activeModels = models.filter((m) => m.is_active)
  const selectedModel = models.find((m) => m.model_id === form.default_model_id)

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground text-sm">
        <Spinner className="size-4" />
        Loading agent configuration...
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Agent Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Manage global AI reasoning models, autonomous behavior, compaction limits, and prompt overrides.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadData(false)}
            disabled={loading || saving}
          >
            <RefreshCwIcon className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? (
              <Spinner className="size-3.5 mr-1.5" />
            ) : (
              <SaveIcon className="size-3.5 mr-1.5" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Security Note Banner */}
      <Card className="border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10">
        <CardContent className="flex items-start gap-3 p-4 text-xs sm:text-sm">
          <LockIcon className="size-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="space-y-1">
            <span className="font-semibold text-amber-900 dark:text-amber-200">
              Zero Secrets Policy in Database
            </span>
            <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed text-xs">
              All provider API keys (e.g. <code className="font-mono px-1 py-0.5 bg-amber-500/10 rounded">OPENAI_API_KEY</code>, <code className="font-mono px-1 py-0.5 bg-amber-500/10 rounded">ANTHROPIC_API_KEY</code>) and sensitive credentials remain strictly in your server's <code className="font-mono px-1 py-0.5 bg-amber-500/10 rounded">.env</code> file. This admin console only manages operational behavior, parameters, and defaults.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Model & Reasoning Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CpuIcon className="size-5 text-primary" />
              <div>
                <CardTitle className="text-base">Default Model & Reasoning</CardTitle>
                <CardDescription>
                  Configure the primary LLM and thinking effort for new workspace sessions
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="default-model" className="text-xs font-medium">
                Default LLM Model
              </Label>
              <select
                id="default-model"
                value={form.default_model_id || ""}
                onChange={(e) =>
                  setForm({ ...form, default_model_id: e.target.value || null })
                }
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">System Default (Auto fallback)</option>
                {activeModels.map((m) => (
                  <option key={m.model_id} value={m.model_id}>
                    {m.name} ({m.model_id}) [{m.provider.toUpperCase()}]
                  </option>
                ))}
              </select>
              {selectedModel && (
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">
                    {selectedModel.provider}
                  </Badge>
                  {selectedModel.supports_effort && (
                    <Badge variant="secondary" className="text-[10px]">
                      Supports Reasoning Effort
                    </Badge>
                  )}
                  {selectedModel.badge && (
                    <Badge variant="secondary" className="text-[10px]">
                      {selectedModel.badge}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="default-effort" className="text-xs font-medium">
                Default Reasoning Effort
              </Label>
              <select
                id="default-effort"
                value={form.default_effort}
                onChange={(e) =>
                  setForm({
                    ...form,
                    default_effort: e.target.value as "low" | "medium" | "high",
                  })
                }
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="low">Low (Fastest responses, lower token usage)</option>
                <option value="medium">Medium (Balanced thinking depth)</option>
                <option value="high">High (Deep reasoning, thorough planning)</option>
              </select>
              <p className="text-[11px] text-muted-foreground">
                Applies when reasoning-capable models (e.g. o1, o3-mini, GPT-5) are selected.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="max-retries" className="text-xs font-medium">
                Max Tool / API Retries (1 - 10)
              </Label>
              <Input
                id="max-retries"
                type="number"
                min={1}
                max={10}
                value={form.max_retries}
                onChange={(e) =>
                  setForm({ ...form, max_retries: Number(e.target.value) || 3 })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Retry count on recoverable API rate limits or transient tool failure.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="space-y-0.5 pr-4">
                <Label htmlFor="autonomous-mode" className="text-sm font-medium cursor-pointer">
                  Autonomous Execution Mode
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allow the agent to run multiple tool steps autonomously until the request is fulfilled.
                </p>
              </div>
              <Switch
                id="autonomous-mode"
                checked={form.autonomous_mode}
                onCheckedChange={(checked) =>
                  setForm({ ...form, autonomous_mode: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Context Window & Compaction */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <HardDriveIcon className="size-5 text-primary" />
              <div>
                <CardTitle className="text-base">Context Window & Compaction</CardTitle>
                <CardDescription>
                  Keep sessions performant by pruning and summarizing long conversational histories
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <div className="space-y-0.5 pr-4">
                <Label htmlFor="compaction-enabled" className="text-sm font-medium cursor-pointer">
                  Enable Context Compaction
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically summarize older conversation turns when token budget is reached.
                </p>
              </div>
              <Switch
                id="compaction-enabled"
                checked={form.compaction_enabled}
                onCheckedChange={(checked) =>
                  setForm({ ...form, compaction_enabled: checked })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="compact-at" className="text-xs font-medium">
                Compact Trigger Threshold (Tokens)
              </Label>
              <Input
                id="compact-at"
                type="number"
                min={1000}
                step={1000}
                disabled={!form.compaction_enabled}
                value={form.compact_at_tokens}
                onChange={(e) =>
                  setForm({
                    ...form,
                    compact_at_tokens: Number(e.target.value) || 20000,
                  })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Session history will be compacted whenever message tokens exceed this threshold.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="keep-recent" className="text-xs font-medium">
                Keep Recent Tokens
              </Label>
              <Input
                id="keep-recent"
                type="number"
                min={500}
                step={500}
                disabled={!form.compaction_enabled}
                value={form.keep_recent_tokens}
                onChange={(e) =>
                  setForm({
                    ...form,
                    keep_recent_tokens: Number(e.target.value) || 6000,
                  })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Tokens from the most recent user and agent messages preserved uncompacted for continuity.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Prompt Customization */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileTextIcon className="size-5 text-primary" />
            <div>
              <CardTitle className="text-base">System Prompt Prefix (Global Directives)</CardTitle>
              <CardDescription>
                Injected at the very beginning of the agent's system prompt across all sessions and workspaces
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            rows={5}
            placeholder="e.g. Always write production-ready TypeScript with strict types. Adhere to Tailwind CSS v4 conventions. Ensure robust error handling on all asynchronous calls."
            value={form.system_prompt_prefix || ""}
            onChange={(e) =>
              setForm({
                ...form,
                system_prompt_prefix: e.target.value,
              })
            }
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to use the built-in system prompt without extra prepended directives.
          </p>
        </CardContent>
      </Card>

      {/* Bottom Save Action */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => loadData(false)}
          disabled={loading || saving}
        >
          Discard Changes
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <Spinner className="size-3.5 mr-1.5" />
          ) : (
            <CheckCircle2Icon className="size-3.5 mr-1.5" />
          )}
          Save Agent Configuration
        </Button>
      </div>
    </form>
  )
}
