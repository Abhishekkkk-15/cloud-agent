import { useState } from "react"
import type { ComponentType } from "react"
import {
  BookOpenIcon,
  BrainIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  FilePlus2Icon,
  FilePenLineIcon,
  ShieldIcon,
  SparklesIcon,
  SquareStackIcon,
  TerminalIcon,
  WrenchIcon,
} from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { Spinner } from "@/components/ui/spinner"
import {
  actionsFromActivities,
  actionsFromEvents,
  summaryFromEvents,
  type AgentActionItem,
  type AgentActionKind,
} from "@/lib/agent-events"
import { cn } from "@/lib/utils"
import { ChatMarkdown } from "@/components/workspace/ChatMarkdown"
import { useWorkspaceStore } from "@/stores/workspace-store"
import type { AgentActivity, AgentEvent } from "@/types/chat-ui"

const kindIcon: Record<AgentActionKind, ComponentType<{ className?: string }>> =
  {
    think: BrainIcon,
    read: BookOpenIcon,
    edit: FilePenLineIcon,
    create: FilePlus2Icon,
    run: TerminalIcon,
    permission: ShieldIcon,
    status: SparklesIcon,
    usage: SquareStackIcon,
    error: CircleAlertIcon,
    compact: SquareStackIcon,
    tool: WrenchIcon,
  }

type AgentEventTurnProps = {
  events?: AgentEvent[]
  activities?: AgentActivity[]
  summary?: string
  streaming?: boolean
  defaultOpen?: boolean
}

export function AgentEventTurn({
  events,
  activities,
  summary,
  streaming,
  defaultOpen = true,
}: AgentEventTurnProps) {
  const openFile = useWorkspaceStore((s) => s.openFile)
  const [open, setOpen] = useState(defaultOpen)

  const actions =
    events && events.length > 0
      ? actionsFromEvents(events)
      : actionsFromActivities(activities ?? [])

  const body =
    summary?.trim() ||
    (events ? summaryFromEvents(events) : undefined) ||
    ""

  if (actions.length === 0 && !body && !streaming) return null

  const headerIcons = uniqueHeaderIcons(actions)

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4 py-1">
      {actions.length > 0 ? (
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="flex items-center -space-x-1">
                {headerIcons.map(({ kind, Icon }) => (
                  <span
                    key={kind}
                    className="flex size-5 items-center justify-center rounded-full bg-background ring-1 ring-border/50"
                  >
                    <Icon className="size-3 opacity-80" />
                  </span>
                ))}
              </span>
              <span className="text-xs">
                {actions.length} {actions.length === 1 ? "action" : "actions"}
              </span>
            </div>

            {body ? (
              <ChatMarkdown content={body} streaming={streaming} />
            ) : streaming ? (
              <p className="text-[15px] leading-7 text-muted-foreground">
                Working
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground align-text-bottom" />
              </p>
            ) : null}

            <CollapsibleContent className="flex flex-col gap-2 overflow-hidden data-ending-style:animate-out data-ending-style:fade-out-0 data-starting-style:animate-in data-starting-style:fade-in-0">
              <button
                type="button"
                className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                <ChevronDownIcon className="size-3.5 rotate-180" />
                Show less
              </button>
              <ul className="flex flex-col gap-1">
                {actions.map((action) => (
                  <ActionRow
                    key={action.id}
                    action={action}
                    onOpenFile={openFile}
                  />
                ))}
              </ul>
            </CollapsibleContent>

            {!open ? (
              <button
                type="button"
                className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setOpen(true)}
              >
                <ChevronDownIcon className="size-3.5" />
                Show more
              </button>
            ) : null}
          </div>
        </Collapsible>
      ) : body ? (
        <ChatMarkdown content={body} streaming={streaming} />
      ) : null}
    </div>
  )
}

function ThinkingActionRow({ action }: { action: AgentActionItem }) {
  const [open, setOpen] = useState(true)

  return (
    <li className="py-1">
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex w-full items-center gap-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
        >
          <span className="flex size-4 shrink-0 items-center justify-center">
            {action.running ? (
              <Spinner className="size-3.5" />
            ) : (
              <BrainIcon className="size-3.5" />
            )}
          </span>
          <span className="flex-1 select-none">
            {action.running ? "Thinking…" : "Thought process"}
          </span>
          {action.detail ? (
            <ChevronDownIcon
              className={cn(
                "size-3.5 text-muted-foreground/70 transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          ) : null}
        </button>

        {open && action.detail ? (
          <div className="mt-1.5 ml-2 border-l-2 border-border/60 pl-3 py-1">
            <ChatMarkdown
              content={action.detail}
              streaming={action.running}
              className="text-xs text-muted-foreground/90 leading-relaxed font-normal [&_p]:mb-1.5 [&_p]:last:mb-0 [&_p]:leading-relaxed [&_li]:leading-relaxed [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs"
            />
          </div>
        ) : null}
      </div>
    </li>
  )
}

function ActionRow({
  action,
  onOpenFile,
}: {
  action: AgentActionItem
  onOpenFile: (fileId: string) => void
}) {
  if (action.kind === "think") {
    return <ThinkingActionRow action={action} />
  }

  const Icon = kindIcon[action.kind]
  const clickable = !!action.fileId

  return (
    <li>
      <button
        type="button"
        disabled={!clickable}
        onClick={() => {
          if (action.fileId) onOpenFile(action.fileId)
        }}
        className={cn(
          "flex w-full items-start gap-2 py-0.5 text-left text-sm text-muted-foreground transition-colors",
          clickable && "hover:text-foreground",
          !clickable && "cursor-default"
        )}
      >
        <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
          {action.running ? (
            <Spinner className="size-3.5" />
          ) : (
            <Icon className="size-3.5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block">{action.label}</span>
          {action.detail && action.kind === "usage" ? (
            <span className="mt-0.5 block text-xs opacity-80">
              {action.detail}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  )
}

function uniqueHeaderIcons(actions: AgentActionItem[]) {
  const seen = new Set<AgentActionKind>()
  const icons: {
    kind: AgentActionKind
    Icon: (typeof kindIcon)[AgentActionKind]
  }[] = []
  for (const action of actions) {
    if (seen.has(action.kind)) continue
    seen.add(action.kind)
    icons.push({ kind: action.kind, Icon: kindIcon[action.kind] })
    if (icons.length >= 5) break
  }
  if (icons.length === 0) {
    icons.push({ kind: "tool", Icon: kindIcon.tool })
  }
  return icons
}
