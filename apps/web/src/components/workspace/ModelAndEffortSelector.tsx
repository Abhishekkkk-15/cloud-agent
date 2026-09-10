import { useRef, useState } from "react"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useWorkspaceStore } from "@/stores/workspace-store"
import {
  AVAILABLE_MODELS,
  EFFORT_CONFIG,
  type ModelOption,
  type ReasoningEffort,
} from "@/types/models"
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

  const [menuOpen, setMenuOpen] = useState(false)
  const [effortHoverOpen, setEffortHoverOpen] = useState(false)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentModel: ModelOption =
    AVAILABLE_MODELS.find((m) => m.id === selectedModelId) ||
    AVAILABLE_MODELS[0]

  const currentEffort = EFFORT_CONFIG[selectedEffort] || EFFORT_CONFIG.high
  const supportsEffort = currentModel.supportsEffort

  // Group models by provider
  const providers = ["OpenAI", "Anthropic", "Google", "DeepSeek"] as const

  const handleMouseEnter = () => {
    if (disabled || menuOpen) return
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setEffortHoverOpen(true)
  }

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setEffortHoverOpen(false)
    }, 180)
  }

  return (
    <div
      className={cn("relative inline-flex items-center", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hover Card for Effort Selection */}
      {effortHoverOpen && !menuOpen && (
        <div
          role="tooltip"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-xl border border-border bg-popover p-2.5 text-popover-foreground shadow-lg ring-1 ring-foreground/5 animate-in fade-in-0 zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between gap-2 pb-2">
            <div className="flex items-center gap-1.5">
              <BrainIcon className="size-3.5 text-primary" />
              <span className="text-[11px] font-semibold tracking-wide text-foreground">
                Reasoning Effort
              </span>
            </div>
            <Badge
              variant={supportsEffort ? currentEffort.badgeVariant : "outline"}
              className="h-4 px-1.5 text-[10px] font-normal"
            >
              {supportsEffort ? currentEffort.shortLabel : "Not Supported"}
            </Badge>
          </div>

          {supportsEffort ? (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-1">
                {(Object.keys(EFFORT_CONFIG) as ReasoningEffort[]).map((key) => {
                  const config = EFFORT_CONFIG[key]
                  const isSelected = config.value === selectedEffort

                  const Icon =
                    key === "low"
                      ? ZapIcon
                      : key === "medium"
                        ? CpuIcon
                        : BrainIcon

                  const iconColor =
                    key === "low"
                      ? "text-amber-500"
                      : key === "medium"
                        ? "text-blue-500"
                        : "text-purple-500"

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedEffort(config.value)
                      }}
                      className={cn(
                        "flex cursor-pointer items-center justify-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium transition-all select-none",
                        isSelected
                          ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                          : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                      )}
                    >
                      <Icon className={cn("size-3", isSelected && iconColor)} />
                      <span>{config.shortLabel}</span>
                    </button>
                  )
                })}
              </div>

              <p className="text-[11px] text-muted-foreground leading-snug">
                {currentEffort.description}
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground leading-snug">
              {currentModel.name} operates in standard execution mode without
              adjustable reasoning tokens.
            </p>
          )}
        </div>
      )}

      {/* Model Selection Dropdown */}
      <DropdownMenu
        open={menuOpen}
        onOpenChange={(open) => {
          setMenuOpen(open)
          if (open) setEffortHoverOpen(false)
        }}
      >
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              className={cn(
                "h-7 gap-1 px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/70",
                compact && "h-6 px-1.5 text-[11px]"
              )}
            />
          }
        >
          <span className="truncate">{currentModel.name}</span>
          <ChevronDownIcon className="size-3 text-muted-foreground opacity-70" data-icon="inline-end" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-72 p-1.5">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Agent Model
            </span>
            {supportsEffort && (
              <span className="text-[10px] text-muted-foreground">
                Effort: <strong className="text-foreground">{currentEffort.shortLabel}</strong>
              </span>
            )}
          </div>
          <DropdownMenuSeparator />

          {providers.map((provider) => {
            const models = AVAILABLE_MODELS.filter((m) => m.provider === provider)
            if (models.length === 0) return null

            return (
              <DropdownMenuGroup key={provider}>
                <div className="px-2 pt-2 pb-1 text-[10px] font-medium text-muted-foreground">
                  {provider}
                </div>
                {models.map((model) => {
                  const isSelected = model.id === currentModel.id
                  return (
                    <DropdownMenuItem
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className={cn(
                        "flex cursor-pointer items-start justify-between gap-2 rounded-md p-2 text-xs",
                        isSelected && "bg-accent/80 font-medium"
                      )}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
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
                        </div>
                        <p className="line-clamp-1 text-[11px] text-muted-foreground">
                          {model.description}
                        </p>
                      </div>
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
