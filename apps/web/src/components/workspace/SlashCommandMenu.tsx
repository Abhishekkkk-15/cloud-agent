import { useEffect, useRef } from "react"
import type { ComponentType } from "react"
import {
  HammerIcon,
  ListTodoIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

export type SlashCommandItem = {
  id: string
  name: string
  title: string
  description: string
  icon: ComponentType<{ className?: string }>
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: "plan",
    name: "/plan",
    title: "Plan Mode",
    description: "Read-only codebase exploration & roadmap generation",
    icon: ListTodoIcon,
  },
  {
    id: "build",
    name: "/build",
    title: "Build Mode",
    description: "Direct code edits, terminal commands & execution",
    icon: HammerIcon,
  },
]

type SlashCommandMenuProps = {
  query: string
  selectedIndex: number
  onSelect: (command: SlashCommandItem) => void
  className?: string
}

export function SlashCommandMenu({
  query,
  selectedIndex,
  onSelect,
  className,
}: SlashCommandMenuProps) {
  const listRef = useRef<HTMLDivElement>(null)

  // Filter commands matching current query after "/"
  const cleanQuery = query.startsWith("/") ? query.slice(1).toLowerCase().trim() : query.toLowerCase().trim()
  const filtered = SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(cleanQuery) ||
      cmd.title.toLowerCase().includes(cleanQuery) ||
      cmd.id.toLowerCase().includes(cleanQuery)
  )

  useEffect(() => {
    // Scroll active item into view
    const activeEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" })
    }
  }, [selectedIndex])

  if (filtered.length === 0) return null

  return (
    <div
      ref={listRef}
      className={cn(
        "absolute bottom-full left-0 mb-2 w-full max-w-sm overflow-hidden rounded-lg border border-border/80 bg-popover/95 p-1 shadow-lg backdrop-blur-md z-30 animate-in fade-in-0 zoom-in-95 duration-100",
        className
      )}
    >
      <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        Slash Commands
      </div>
      <div className="flex flex-col gap-0.5">
        {filtered.map((item, index) => {
          const Icon = item.icon
          const isSelected = index === selectedIndex

          return (
            <div
              key={item.id}
              data-index={index}
              onMouseDown={(e) => {
                // Prevent textarea blur before click registers
                e.preventDefault()
                onSelect(item)
              }}
              className={cn(
                "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer select-none",
                isSelected
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <div
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md border border-border/50 bg-background/80 transition-colors",
                  isSelected ? "text-primary border-primary/30" : "text-muted-foreground"
                )}
              >
                <Icon className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-medium text-foreground">{item.name}</span>
                  <span className="text-[11px] opacity-75 font-normal">({item.title})</span>
                </div>
                <p className="truncate text-[11px] text-muted-foreground leading-tight">
                  {item.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
