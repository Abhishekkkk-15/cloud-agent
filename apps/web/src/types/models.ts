export type ReasoningEffort = "low" | "medium" | "high"

export type ModelOption = {
  id: string
  name: string
  model_id?: string
  provider: string
  url?: string | null
  base_url?: string | null
  badge?: string
  description: string
  supportsEffort: boolean
  use_case?: string[]
  isActive?: boolean
  isDefault?: boolean
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: "auto",
    name: "Auto",
    provider: "OpenAI",
    badge: "Auto",
    description: "Automatically selects the best model and reasoning depth",
    supportsEffort: false,
    use_case: ["auto-routing", "intent-matching", "general"],
  },
  {
    id: "gpt-5.6-luna",
    name: "GPT-5.6 Luna",
    provider: "OpenAI",
    badge: "Default",
    description: "Next-gen flagship reasoning and agentic execution",
    supportsEffort: true,
    use_case: ["coding", "fullstack", "architecture", "deep-reasoning"],
  },
  {
    id: "claude-3-7-sonnet",
    name: "Claude 3.7 Sonnet",
    provider: "Anthropic",
    badge: "Reasoning",
    description: "Hybrid reasoning model with deep coding & architecture skills",
    supportsEffort: true,
    use_case: ["coding", "architecture", "deep-reasoning", "refactoring"],
  },
  {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    badge: "Fast",
    description: "Fast, precise, intelligent coding assistant",
    supportsEffort: false,
    use_case: ["coding", "fast-agent", "frontend", "general"],
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    badge: "Omni",
    description: "High-speed multimodal model for general tasks",
    supportsEffort: false,
    use_case: ["coding", "fullstack", "architecture", "general"],
  },
  {
    id: "o3-mini",
    name: "o3-mini",
    provider: "OpenAI",
    badge: "Math & Code",
    description: "Specialized STEM and coding reasoning model",
    supportsEffort: true,
    use_case: ["math", "reasoning", "complex-logic", "algorithm"],
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    badge: "Open Reasoning",
    description: "Open-weights reasoning model with chain-of-thought",
    supportsEffort: true,
    use_case: ["math", "reasoning", "deep-thinking", "algorithm"],
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    badge: "1M Context",
    description: "Advanced reasoning with massive multimodal context window",
    supportsEffort: true,
    use_case: ["long-context", "multimodal", "large-repo-analysis"],
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
