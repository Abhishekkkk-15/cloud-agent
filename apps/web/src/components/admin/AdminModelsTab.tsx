import { useEffect, useState } from "react"
import {
  CpuIcon,
  Edit2Icon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  deleteModel,
  getAllModels,
  seedDefaultModels,
  updateModel,
} from "@/lib/api"
import { getApiErrorMessage } from "@/lib/http"
import type { LLMModel } from "@cloud-agent/shared"

import { AddEditModelDialog } from "./AddEditModelDialog"

export function AdminModelsTab() {
  const [models, setModels] = useState<LLMModel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [providerFilter, setProviderFilter] = useState("all")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<LLMModel | null>(null)
  const [busyModelId, setBusyModelId] = useState<string | null>(null)

  async function load(isSilent = false) {
    if (!isSilent) setLoading(true)
    try {
      const res = await getAllModels()
      setModels(res)
    } catch (err) {
      if (!isSilent) {
        toast.error(getApiErrorMessage(err, "Failed to load models"))
      }
    } finally {
      if (!isSilent) setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleToggleActive(m: LLMModel) {
    setBusyModelId(m.model_id)
    try {
      await updateModel(m.model_id, { is_active: !m.is_active })
      toast.success(
        `Model "${m.name}" is now ${!m.is_active ? "active" : "inactive"}`
      )
      await load(true)
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to toggle model active status"))
    } finally {
      setBusyModelId(null)
    }
  }

  async function handleSetDefault(m: LLMModel) {
    setBusyModelId(m.model_id)
    try {
      await updateModel(m.model_id, { is_default: true, is_active: true })
      toast.success(`Set "${m.name}" as default model`)
      await load(true)
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to set default model"))
    } finally {
      setBusyModelId(null)
    }
  }

  async function handleDelete(m: LLMModel) {
    if (!confirm(`Are you sure you want to delete model "${m.name}" (${m.model_id})?`)) return
    setBusyModelId(m.model_id)
    try {
      await deleteModel(m.model_id)
      toast.success(`Model "${m.name}" deleted`)
      await load(true)
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to delete model"))
    } finally {
      setBusyModelId(null)
    }
  }

  async function handleSeed() {
    setLoading(true)
    try {
      const res = await seedDefaultModels()
      toast.success(`Seeded default models (${res.seeded} seeded)`)
      await load(true)
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to seed models"))
    } finally {
      setLoading(false)
    }
  }

  const providers = Array.from(new Set(models.map((m) => m.provider)))

  const filtered = models.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.model_id.toLowerCase().includes(search.toLowerCase()) ||
      m.provider.toLowerCase().includes(search.toLowerCase())
    const matchesProvider =
      providerFilter === "all" ? true : m.provider.toLowerCase() === providerFilter.toLowerCase()
    return matchesSearch && matchesProvider
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">AI Models Catalog</h2>
          <p className="text-sm text-muted-foreground">
            Configure LLM providers, set default models, customize token pricing, and toggle model availability.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSeed} disabled={loading}>
            <SparklesIcon className="size-3.5" />
            Seed Default Models
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              setEditingModel(null)
              setDialogOpen(true)
            }}
          >
            <PlusIcon className="size-3.5" />
            Add AI Model
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => void load()} disabled={loading}>
            <RefreshCwIcon className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search models by name, model ID, or provider..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All Providers ({models.length})</option>
          {providers.map((p) => (
            <option key={p} value={p}>
              {p.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Models Table / List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Spinner />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center">
              <CpuIcon className="size-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium">No models found</p>
              <p className="text-xs text-muted-foreground">
                Click "Add AI Model" or "Seed Default Models" to populate the catalog.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Model</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Context / Max</th>
                    <th className="px-4 py-3">Pricing ($ / 1M)</th>
                    <th className="px-4 py-3">Features</th>
                    <th className="px-4 py-3">Default</th>
                    <th className="px-4 py-3">Active</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((m) => {
                    const isBusy = busyModelId === m.model_id
                    return (
                      <tr key={m.model_id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{m.name}</span>
                            {m.badge ? (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {m.badge}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {m.model_id}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="capitalize font-mono">
                            {m.provider}
                          </Badge>
                          {m.has_api_key || m.api_key_env ? (
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                              Key configured
                            </div>
                          ) : (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                              No key
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          <div>
                            Ctx: {m.context_window ? m.context_window.toLocaleString() : "N/A"}
                          </div>
                          <div className="text-[10px]">
                            Max: {m.max_tokens ? m.max_tokens.toLocaleString() : "N/A"}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          <div>In: ${m.input_price_per_mtok.toFixed(2)}</div>
                          <div className="text-[10px]">
                            Out: ${m.output_price_per_mtok.toFixed(2)}
                          </div>
                          {(m.cached_price_per_mtok ?? 0) > 0 && (
                            <div className="text-[10px] text-blue-500">
                              Cached: ${(m.cached_price_per_mtok ?? 0).toFixed(3)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 items-start">
                            {m.supports_effort && (
                              <Badge variant="outline" className="text-[10px]">
                                Effort: {m.default_effort || "supported"}
                              </Badge>
                            )}
                            {m.is_multi_model && (
                              <Badge variant="secondary" className="text-[10px]">
                                Multimodal
                              </Badge>
                            )}
                            {!m.supports_effort && !m.is_multi_model && (
                              <span className="text-muted-foreground text-[11px]">Standard</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {m.is_default ? (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1">
                              <StarIcon className="size-3 fill-amber-500 text-amber-500" />
                              Default
                            </Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[11px] text-muted-foreground"
                              onClick={() => handleSetDefault(m)}
                              disabled={isBusy}
                            >
                              Make Default
                            </Button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Switch
                            checked={m.is_active}
                            onCheckedChange={() => handleToggleActive(m)}
                            disabled={isBusy}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Edit Model"
                              onClick={() => {
                                setEditingModel(m)
                                setDialogOpen(true)
                              }}
                              disabled={isBusy}
                            >
                              <Edit2Icon className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Delete Model"
                              onClick={() => handleDelete(m)}
                              disabled={isBusy}
                            >
                              <Trash2Icon className="size-3.5 text-destructive" />
                            </Button>
                          </div>
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

      {/* Add / Edit Dialog */}
      <AddEditModelDialog
        open={dialogOpen}
        model={editingModel}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => void load(true)}
      />
    </div>
  )
}
