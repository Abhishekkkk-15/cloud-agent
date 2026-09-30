import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { SparklesIcon, ArrowRightIcon, TerminalIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface HeroPromptInputProps {
  onPresetChange?: (preset: string) => void
}

const PRESET_CHIPS = [
  {
    id: "kanban",
    label: "⚡ Fullstack Kanban Board",
    prompt: "Build a responsive Kanban board with Vite, Tailwind CSS, drag-and-drop tasks, and Express backend.",
  },
  {
    id: "chat",
    label: "💬 Real-time AI Chat",
    prompt: "Create an AI chat app with streaming tokens, code highlighting, and simulated model provider selector.",
  },
  {
    id: "analytics",
    label: "📊 Crypto Analytics Dashboard",
    prompt: "Build a dark-mode crypto analytics dashboard with interactive price charts, portfolio cards, and mock websockets.",
  },
]

export function HeroPromptInput({ onPresetChange }: HeroPromptInputProps) {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState(PRESET_CHIPS[0].prompt)
  const [activeChip, setActiveChip] = useState(PRESET_CHIPS[0].id)

  const handleSelectPreset = (chip: typeof PRESET_CHIPS[0]) => {
    setActiveChip(chip.id)
    setPrompt(chip.prompt)
    onPresetChange?.(chip.id)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Direct user to login/dashboard with prefilled intention
    navigate("/login")
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4">
      {/* Interactive Glassmorphic Input Box */}
      <form
        onSubmit={handleSubmit}
        className="group relative flex w-full flex-col sm:flex-row items-center gap-2 rounded-2xl border border-border/80 bg-card/70 p-2 shadow-2xl backdrop-blur-xl transition-all duration-300 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 hover:border-border"
      >
        <div className="flex w-full items-center gap-2.5 px-3 py-1.5 flex-1">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <SparklesIcon className="size-4 text-sky-400" />
          </div>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe any web app or fullstack project to generate..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none font-sans"
          />
        </div>

        <Button
          type="submit"
          size="default"
          className="w-full sm:w-auto shrink-0 gap-2 font-medium px-5 rounded-xl shadow-lg transition-transform active:scale-95"
        >
          <span>Launch in Sandbox</span>
          <ArrowRightIcon className="size-4" />
        </Button>
      </form>

      {/* Preset Chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        <span className="text-muted-foreground mr-1 flex items-center gap-1">
          <TerminalIcon className="size-3" /> Quick presets:
        </span>
        {PRESET_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => handleSelectPreset(chip)}
            className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-all ${
              activeChip === chip.id
                ? "border-primary bg-primary/15 text-primary shadow-sm"
                : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  )
}
