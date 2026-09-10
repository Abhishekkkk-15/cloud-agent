import { useEffect, useState } from "react"
import {
  BrainIcon,
  CheckIcon,
  ChevronDownIcon,
  CpuIcon,
  ZapIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useWorkspaceStore } from "@/stores/workspace-store"
import {
  AVAILABLE_MODELS,
  EFFORT_CONFIG,
  type ModelOption,
  type ReasoningEffort,
} from "@/types/models"
import { listModels } from "@/lib/api"
import { cn } from "@/lib/utils"

interface ModelAndEffortSelectorProps {
  compact?: boolean
  className?: string
  disabled?: boolean
}

export function ModelAndEffortSelector({
  compact = false,
  className,
  disabled = false,
}: ModelAndEffortSelectorProps) {
  const selectedModelId = useWorkspaceStore((s) => s.selectedModel)
  const selectedEffort = useWorkspaceStore((s) => s.selectedEffort)
  const setSelectedModel = useWorkspaceStore((s) => s.setSelectedModel)
  const setSelectedEffort = useWorkspaceStore((s) => s.setSelectedEffort)

  const [modelsList, setModelsList] = useState<ModelOption[]>(AVAILABLE_MODELS)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    listModels()
      .then((backendModels) => {
        if (cancelled || !backendModels || backendModels.length === 0) return
        const mapped: ModelOption[] = backendModels.map((bm) => ({
          id: bm.model_id || bm.id,
          name: bm.name,
          model_id: bm.model_id,
          provider: bm.provider.charAt(0).toUpperCase() + bm.provider.slice(1),
          url: bm.url || bm.base_url,
          base_url: bm.base_url,
          badge: bm.badge || undefined,
          description: bm.description,
          supportsEffort: bm.supports_effort,
          use_case: bm.use_case,
          isActive: bm.is_active,
          isDefault: bm.is_default,
        }))
        const hasAuto = mapped.some((m) => m.id === "auto")
        const autoOption: ModelOption = {
          id: "auto",
          name: "Auto",
          provider: "OpenAI",
          badge: "Auto",
          description: "Automatically selects the best model comparing use cases",
          supportsEffort: true,
          use_case: ["auto-routing", "intent-matching", "general"],
        }
        setModelsList(hasAuto ? mapped : [autoOption, ...mapped])
      })
      .catch((err) => {
        console.warn("Using default models fallback:", err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const currentModel: ModelOption =
    modelsList.find((m) => m.id === selectedModelId) ||
    modelsList[0] ||
    AVAILABLE_MODELS[0]

  const currentEffort = EFFORT_CONFIG[selectedEffort] || EFFORT_CONFIG.high
  const supportsEffort = currentModel.supportsEffort

  // Dynamic providers from active models
  const providers = Array.from(new Set(modelsList.map((m) => m.provider)))

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              className={cn(
                "h-7 gap-1.5 px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/70",
                compact && "h-6 px-1.5 text-[11px]"
              )}
            />
          }
        >
          <span className="truncate">{currentModel.name}</span>
          {supportsEffort && (
            <span className="text-[10px] text-muted-foreground font-normal">
              ({currentEffort.shortLabel})
            </span>
          )}
          <ChevronDownIcon
            className="size-3 text-muted-foreground opacity-70"
            data-icon="inline-end"
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-80 p-1.5 shadow-xl">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Agent Model
            </span>
            {supportsEffort && (
              <span className="text-[10px] text-muted-foreground">
                Current Effort:{" "}
                <strong className="text-foreground">
                  {currentEffort.shortLabel}
                </strong>
              </span>
            )}
          </div>
          <DropdownMenuSeparator />

          {providers.map((provider) => {
            const models = modelsList.filter((m) => m.provider === provider)
            if (models.length === 0) return null

            return (
              <DropdownMenuGroup key={provider}>
                <div className="px-2 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {provider}
                </div>
                {models.map((model) => {
                  const isSelected = model.id === currentModel.id
                  const modelSupportsEffort = model.supportsEffort

                  const modelInfo = (
                    <div className="flex min-w-0 flex-1 flex-col gap-1 pr-1 text-left">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-foreground">
                          {model.name}
                        </span>
                        {model.badge && (
                          <Badge
                            variant={isSelected ? "default" : "outline"}
                            className="h-3.5 px-1 text-[9px] font-normal"
                          >
                            {model.badge}
                          </Badge>
                        )}
                        {isSelected && modelSupportsEffort && (
                          <span className="ml-auto text-[10px] text-primary font-medium">
                            {currentEffort.shortLabel}
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-1 text-[11px] text-muted-foreground">
                        {model.description}
                      </p>
                      {model.use_case && model.use_case.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-0.5">
                          {model.use_case.slice(0, 3).map((uc) => (
                            <span
                              key={uc}
                              className="rounded bg-muted/60 px-1 py-0.2 text-[9px] text-muted-foreground font-mono"
                            >
                              #{uc}
                            </span>
                          ))}
                          {model.use_case.length > 3 && (
                            <span className="text-[9px] text-muted-foreground">
                              +{model.use_case.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )

                  if (modelSupportsEffort) {
                    return (
                      <DropdownMenuSub key={model.id}>
                        <DropdownMenuSubTrigger
                          onClick={() => {
                            setSelectedModel(model.id)
                            setMenuOpen(false)
                          }}
                          className={cn(
                            "flex cursor-pointer items-center justify-between gap-2 rounded-md p-2 text-xs",
                            isSelected && "bg-accent/80 font-medium"
                          )}
                        >
                          {modelInfo}
                        </DropdownMenuSubTrigger>

                        <DropdownMenuSubContent
                          side="right"
                          align="start"
                          sideOffset={6}
                          className="w-64 min-w-[240px] p-1.5 shadow-xl"
                        >
                          <div className="flex items-center justify-between px-2 py-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Reasoning Effort
                            </span>
                            <span className="text-[10px] font-medium text-foreground">
                              {model.name}
                            </span>
                          </div>
                          <DropdownMenuSeparator />
                          {(
                            Object.keys(EFFORT_CONFIG) as ReasoningEffort[]
                          ).map((effortKey) => {
                            const effort = EFFORT_CONFIG[effortKey]
                            const isEffortSelected =
                              isSelected && selectedEffort === effortKey
                            const EffortIcon =
                              effortKey === "low"
                                ? ZapIcon
                                : effortKey === "medium"
                                  ? CpuIcon
                                  : BrainIcon

                            return (
                              <DropdownMenuItem
                                key={effortKey}
                                onClick={() => {
                                  setSelectedModel(model.id)
                                  setSelectedEffort(effortKey)
                                  setMenuOpen(false)
                                }}
                                className={cn(
                                  "flex cursor-pointer items-start justify-between gap-2 rounded-md p-2 text-xs",
                                  isEffortSelected &&
                                    "bg-accent/80 font-medium"
                                )}
                              >
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <EffortIcon
                                      className={cn(
                                        "size-3",
                                        effortKey === "low"
                                          ? "text-amber-500"
                                          : effortKey === "medium"
                                            ? "text-blue-500"
                                            : "text-purple-500"
                                      )}
                                    />
                                    <span className="font-medium text-foreground">
                                      {effort.label}
                                    </span>
                                    <Badge
                                      variant={effort.badgeVariant}
                                      className="h-3.5 px-1 text-[9px] font-normal"
                                    >
                                      {effort.shortLabel}
                                    </Badge>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground leading-tight">
                                    {effort.description}
                                  </p>
                                </div>
                                {isEffortSelected && (
                                  <CheckIcon className="mt-0.5 size-3.5 text-primary shrink-0" />
                                )}
                              </DropdownMenuItem>
                            )
                          })}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    )
                  }

                  return (
                    <DropdownMenuItem
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id)
                        setMenuOpen(false)
                      }}
                      className={cn(
                        "flex cursor-pointer items-start justify-between gap-2 rounded-md p-2 text-xs",
                        isSelected && "bg-accent/80 font-medium"
                      )}
                    >
                      {modelInfo}
                      {isSelected && (
                        <CheckIcon className="mt-0.5 size-3.5 text-primary shrink-0" />
                      )}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuGroup>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
