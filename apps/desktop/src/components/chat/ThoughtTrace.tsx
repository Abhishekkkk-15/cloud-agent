import { useState } from "react"
import { BrainIcon, ChevronDownIcon } from "lucide-react"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

export function ThoughtTrace({
  thought,
  durationMs,
  isStreaming = false,
  defaultOpen = false,
}: {
  thought: string
  durationMs?: number
  isStreaming?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen || isStreaming)

  if (!thought && !isStreaming) return null

  const durationStr = durationMs
    ? `${(durationMs / 1000).toFixed(1)}s`
    : isStreaming
    ? "thinking..."
    : null

  return (
    <div className="my-1.5 w-full">
      <Collapsible open={open} onOpenChange={setOpen}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="group flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer"
        >
          <BrainIcon className={cn("size-3.5 text-primary/70", isStreaming && "animate-pulse text-primary")} />
          <span className="font-medium">
            {isStreaming ? "Reasoning" : "Thought process"}
          </span>
          {durationStr && (
            <span className="text-[10px] text-muted-foreground/60 font-mono">
              ({durationStr})
            </span>
          )}
          <ChevronDownIcon
            className={cn(
              "size-3 text-muted-foreground/60 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>

        <CollapsibleContent>
          <div className="mt-1.5 rounded-lg border-l-2 border-primary/30 bg-muted/20 py-2 pl-3 pr-2 text-[11px] font-mono leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {thought}
            {isStreaming && (
              <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary ml-1" />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
