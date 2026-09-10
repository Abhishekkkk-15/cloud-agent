export type ReasoningEffort = "low" | "medium" | "high"

export type ModelOption = {
  id: string
  name: string
  provider: "OpenAI" | "Anthropic" | "Google" | "DeepSeek"
  badge?: string
  description: string
  supportsEffort: boolean
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: "auto",
    name: "Auto",
    provider: "OpenAI",
    badge: "Auto",
    description: "Automatically selects the best model and reasoning depth",
    supportsEffort: true,
  },
  {
    id: "gpt-5.6-luna",
    name: "GPT-5.6 Luna",
    provider: "OpenAI",
    badge: "Default",
    description: "Next-gen flagship reasoning and agentic execution",
    supportsEffort: true,
  },
  {
    id: "claude-3-7-sonnet",
    name: "Claude 3.7 Sonnet",
    provider: "Anthropic",
    badge: "Reasoning",
    description: "Hybrid reasoning model with deep coding & architecture skills",
    supportsEffort: true,
  },
  {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    badge: "Fast",
    description: "Fast, precise, intelligent coding assistant",
    supportsEffort: false,
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    badge: "Omni",
    description: "High-speed multimodal model for general tasks",
    supportsEffort: false,
  },
  {
    id: "o3-mini",
    name: "o3-mini",
    provider: "OpenAI",
    badge: "Math & Code",
    description: "Specialized STEM and coding reasoning model",
    supportsEffort: true,
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    badge: "Open Reasoning",
    description: "Open-weights reasoning model with chain-of-thought",
    supportsEffort: true,
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    badge: "1M Context",
    description: "Advanced reasoning with massive multimodal context window",
    supportsEffort: true,
  },
]

export const EFFORT_CONFIG: Record<
  ReasoningEffort,
  {
    value: ReasoningEffort
    label: string
    shortLabel: string
    description: string
    badgeVariant: "default" | "secondary" | "outline"
  }
> = {
  low: {
    value: "low",
    label: "Low Effort",
    shortLabel: "Low",
    description: "Fast responses with concise reasoning",
    badgeVariant: "outline",
  },
  medium: {
    value: "medium",
    label: "Medium Effort",
    shortLabel: "Medium",
    description: "Balanced reasoning depth and latency for standard features",
    badgeVariant: "secondary",
  },
  high: {
    value: "high",
    label: "High Effort",
    shortLabel: "High",
    description: "Maximum reasoning depth for complex architecture & tough bugs",
    badgeVariant: "default",
  },
}
