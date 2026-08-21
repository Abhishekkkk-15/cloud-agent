import { useState } from "react"
import { TerminalIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { cn } from "@/lib/utils"

export function TerminalPanel() {
  const lines = useWorkspaceStore((s) => s.terminalLines)
  const executeCommand = useWorkspaceStore((s) => s.executeCommand)
  const bottomPanel = useWorkspaceStore((s) => s.bottomPanel)
  const setBottomPanel = useWorkspaceStore((s) => s.setBottomPanel)
  const [command, setCommand] = useState("")
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!command.trim() || busy) return
    setBusy(true)
    try {
      await executeCommand(command.trim())
      setCommand("")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-2">
        <Tabs
          value={bottomPanel}
          onValueChange={(value) => {
            if (value === "console" || value === "shell") setBottomPanel(value)
          }}
        >
          <TabsList variant="line">
            <TabsTrigger value="console">Output</TabsTrigger>
            <TabsTrigger value="shell">Shell</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => void executeCommand("clear")}
        >
          Clear
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 p-3 font-mono text-xs leading-5">
          {lines.map((line) => (
            <div
              key={line.id}
              className={cn(
                line.type === "command" && "text-foreground",
                line.type === "stdout" && "text-muted-foreground",
                line.type === "stderr" && "text-destructive",
                line.type === "info" && "text-muted-foreground italic"
              )}
            >
              {line.text}
            </div>
          ))}
          {lines.length === 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <TerminalIcon className="size-3.5" />
              Ready — run the app or type a command
            </div>
          )}
        </div>
      </ScrollArea>

      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 border-t px-3 py-2"
      >
        <span className="font-mono text-xs text-muted-foreground">$</span>
        <Input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="npm run dev"
          className="h-7 border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0"
          disabled={busy}
        />
      </form>
    </div>
  )
}
