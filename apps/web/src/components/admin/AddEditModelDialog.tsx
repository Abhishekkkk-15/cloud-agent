import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { createModel, updateModel } from "@/lib/api"
import { getApiErrorMessage } from "@/lib/http"
import type { LLMModel } from "@cloud-agent/shared"

type Props = {
  open: boolean
  model: LLMModel | null // If null, create mode; otherwise edit mode
  onClose: () => void
  onSuccess: () => void
}

export function AddEditModelDialog({ open, model, onClose, onSuccess }: Props) {
  const isEdit = Boolean(model)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState("")
  const [modelId, setModelId] = useState("")
  const [provider, setProvider] = useState("openai")
  const [baseUrl, setBaseUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [apiKeyEnv, setApiKeyEnv] = useState("")
  const [badge, setBadge] = useState("")
  const [description, setDescription] = useState("")
  const [contextWindow, setContextWindow] = useState<number | "">("")
  const [maxTokens, setMaxTokens] = useState<number | "">("")
  const [inputPrice, setInputPrice] = useState<number | "">("")
  const [outputPrice, setOutputPrice] = useState<number | "">("")
  const [cachedPrice, setCachedPrice] = useState<number | "">("")
  const [supportsEffort, setSupportsEffort] = useState(false)
  const [isMultiModel, setIsMultiModel] = useState(false)
  const [defaultEffort, setDefaultEffort] = useState<string>("medium")
  const [isActive, setIsActive] = useState(true)
  const [isDefault, setIsDefault] = useState(false)

  useEffect(() => {
    if (model) {
      setName(model.name)
      setModelId(model.model_id)
      setProvider(model.provider)
      setBaseUrl(model.base_url || model.url || "")
      setApiKey("")
      setApiKeyEnv(model.api_key_env || "")
      setBadge(model.badge || "")
      setDescription(model.description || "")
      setContextWindow(model.context_window ?? "")
      setMaxTokens(model.max_tokens ?? "")
      setInputPrice(model.input_price_per_mtok ?? "")
      setOutputPrice(model.output_price_per_mtok ?? "")
      setCachedPrice(model.cached_price_per_mtok ?? "")
      setSupportsEffort(Boolean(model.supports_effort))
      setIsMultiModel(Boolean(model.is_multi_model))
      setDefaultEffort(model.default_effort || "medium")
      setIsActive(model.is_active)
      setIsDefault(model.is_default)
    } else {
      setName("")
      setModelId("")
      setProvider("openai")
      setBaseUrl("")
      setApiKey("")
      setApiKeyEnv("")
      setBadge("")
      setDescription("")
      setContextWindow("")
      setMaxTokens("")
      setInputPrice("")
      setOutputPrice("")
      setCachedPrice("")
      setSupportsEffort(false)
      setIsMultiModel(false)
      setDefaultEffort("medium")
      setIsActive(true)
      setIsDefault(false)
    }
  }, [model, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !modelId.trim() || !provider.trim()) {
      toast.error("Please fill in Name, Model ID, and Provider.")
      return
    }

    setBusy(true)
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        model_id: modelId.trim(),
        provider: provider.trim(),
        base_url: baseUrl.trim() || null,
        url: baseUrl.trim() || null,
        api_key_env: apiKeyEnv.trim() || null,
        badge: badge.trim() || null,
        description: description.trim(),
        context_window: contextWindow === "" ? null : Number(contextWindow),
        max_tokens: maxTokens === "" ? null : Number(maxTokens),
        input_price_per_mtok: inputPrice === "" ? 0 : Number(inputPrice),
        output_price_per_mtok: outputPrice === "" ? 0 : Number(outputPrice),
        cached_price_per_mtok: cachedPrice === "" ? 0 : Number(cachedPrice),
        supports_effort: supportsEffort,
        is_multi_model: isMultiModel,
        default_effort: supportsEffort ? defaultEffort : null,
        is_active: isActive,
        is_default: isDefault,
      }

      if (apiKey.trim()) {
        payload.api_key = apiKey.trim()
      }

      if (isEdit && model) {
        await updateModel(model.model_id, payload)
        toast.success(`Model "${name}" updated successfully`)
      } else {
        await createModel(payload)
        toast.success(`Model "${name}" registered successfully`)
      }
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to save model"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit AI Model" : "Add New AI Model"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? `Update configuration for model ${model?.model_id}`
                : "Register a new LLM provider model to make it available for workspaces."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="model-name">Display Name *</Label>
              <Input
                id="model-name"
                placeholder="e.g. GPT-4o, Claude 3.5 Sonnet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="model-id">Model ID *</Label>
              <Input
                id="model-id"
                placeholder="e.g. gpt-4o, claude-3-5-sonnet-20241022"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                disabled={isEdit}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="model-provider">Provider *</Label>
              <select
                id="model-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google Gemini</option>
                <option value="azure">Azure OpenAI</option>
                <option value="deepseek">DeepSeek</option>
                <option value="ollama">Ollama / Local</option>
                <option value="custom">Custom Provider</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="model-badge">Badge Tag (optional)</Label>
              <Input
                id="model-badge"
                placeholder="e.g. FAST, PRO, REASONING"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="model-url">Base URL / Endpoint (optional)</Label>
              <Input
                id="model-url"
                placeholder="e.g. https://api.openai.com/v1 or custom proxy"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="model-key">API Key (optional / encrypted)</Label>
              <Input
                id="model-key"
                type="password"
                placeholder={isEdit ? "(Leave blank to keep existing)" : "sk-..."}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="model-key-env">API Key Env Var (optional)</Label>
              <Input
                id="model-key-env"
                placeholder="e.g. OPENAI_API_KEY, ANTHROPIC_API_KEY"
                value={apiKeyEnv}
                onChange={(e) => setApiKeyEnv(e.target.value)}
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="model-desc">Description</Label>
              <Input
                id="model-desc"
                placeholder="Short model summary shown to users"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="model-ctx">Context Window (tokens)</Label>
              <Input
                id="model-ctx"
                type="number"
                placeholder="e.g. 128000"
                value={contextWindow}
                onChange={(e) =>
                  setContextWindow(e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="model-maxtok">Max Output Tokens</Label>
              <Input
                id="model-maxtok"
                type="number"
                placeholder="e.g. 16384"
                value={maxTokens}
                onChange={(e) =>
                  setMaxTokens(e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="model-inprice">Input Price ($ / 1M tokens)</Label>
              <Input
                id="model-inprice"
                type="number"
                step="0.01"
                placeholder="e.g. 2.50"
                value={inputPrice}
                onChange={(e) =>
                  setInputPrice(e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="model-outprice">Output Price ($ / 1M tokens)</Label>
              <Input
                id="model-outprice"
                type="number"
                step="0.01"
                placeholder="e.g. 10.00"
                value={outputPrice}
                onChange={(e) =>
                  setOutputPrice(e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="model-cachedprice">Cached Price ($ / 1M tokens)</Label>
              <Input
                id="model-cachedprice"
                type="number"
                step="0.001"
                placeholder="e.g. 1.25 (leave 0 for auto)"
                value={cachedPrice}
                onChange={(e) =>
                  setCachedPrice(e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="model-effort" className="font-medium">
                  Reasoning Effort Support
                </Label>
                <p className="text-xs text-muted-foreground">
                  Supports reasoning level (low, medium, high) like o1/o3 models
                </p>
              </div>
              <Switch
                id="model-effort"
                checked={supportsEffort}
                onCheckedChange={setSupportsEffort}
              />
            </div>

            {supportsEffort && (
              <div className="pt-1">
                <Label className="text-xs">Default Effort</Label>
                <select
                  value={defaultEffort}
                  onChange={(e) => setDefaultEffort(e.target.value)}
                  className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-3">
              <div>
                <Label htmlFor="model-multimodal" className="font-medium">
                  Multimodal Support (is_multi_model)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Model natively processes multimodal inputs (images, audio, documents)
                </p>
              </div>
              <Switch
                id="model-multimodal"
                checked={isMultiModel}
                onCheckedChange={setIsMultiModel}
              />
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <div>
                <Label htmlFor="model-active" className="font-medium">
                  Active Status
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allow users to select and use this model
                </p>
              </div>
              <Switch
                id="model-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <div>
                <Label htmlFor="model-default" className="font-medium">
                  Default Model
                </Label>
                <p className="text-xs text-muted-foreground">
                  Default model assigned to newly created workspaces
                </p>
              </div>
              <Switch
                id="model-default"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : isEdit ? "Save Changes" : "Create Model"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
