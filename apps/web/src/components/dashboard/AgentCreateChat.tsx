import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowUpIcon,
  GitBranchIcon,
  HammerIcon,
  ListTodoIcon,
  SparklesIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ImportGithubRepoDialog } from "@/components/dashboard/ImportGithubRepoDialog"
import {
  SlashCommandMenu,
  SLASH_COMMANDS,
  type SlashCommandItem,
} from "@/components/workspace/SlashCommandMenu"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { getApiErrorMessage } from "@/lib/http"
import { cn } from "@/lib/utils"
import { useWorkspaceListStore } from "@/stores/workspace-list-store"

const prompts = [
  "Habit tracker in React",
  "Flask notes API with JWT",
  "SaaS landing page",
  "Go folder-watcher CLI",
]

export function AgentCreateChat() {
  const navigate = useNavigate()
  const create = useWorkspaceListStore((s) => s.create)
  const creating = useWorkspaceListStore((s) => s.creating)
  const [prompt, setPrompt] = useState("")
  const [mode, setMode] = useState<"build" | "plan">("build")
  const [importOpen, setImportOpen] = useState(false)

  // Slash commands logic
  const isSlashCommandOpen =
    prompt.startsWith("/") &&
    !prompt.includes(" ") &&
    !prompt.includes("\n")

  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0)

  const cleanSlashQuery = prompt.startsWith("/")
    ? prompt.slice(1).toLowerCase().trim()
    : prompt.toLowerCase().trim()

  const matchingSlashCommands = SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(cleanSlashQuery) ||
      cmd.title.toLowerCase().includes(cleanSlashQuery) ||
      cmd.id.toLowerCase().includes(cleanSlashQuery)
  )

  useEffect(() => {
    setSelectedSlashIndex(0)
  }, [cleanSlashQuery])

  const handleSelectSlashCommand = (cmd: SlashCommandItem) => {
    if (cmd.id === "plan") {
      setMode("plan")
      setPrompt("")
      toast.success("Switched to Plan Mode (Read-only planning)")
    } else if (cmd.id === "build") {
      setMode("build")
      setPrompt("")
      toast.success("Switched to Build Mode (Direct code execution)")
    }
  }

  async function startWorkspace(value: string) {
    const trimmed = value.trim()
    if (!trimmed || creating) return

    let effectivePrompt = trimmed
    let effectiveMode = mode

    if (effectivePrompt.toLowerCase().startsWith("/plan")) {
      effectiveMode = "plan"
      effectivePrompt = effectivePrompt.slice(5).trim()
      if (!effectivePrompt) {
        setMode("plan")
        setPrompt("")
        toast.info("Switched to Plan Mode")
        return
      }
    } else if (effectivePrompt.toLowerCase().startsWith("/build")) {
      effectiveMode = "build"
      effectivePrompt = effectivePrompt.slice(6).trim()
      if (!effectivePrompt) {
        setMode("build")
        setPrompt("")
        toast.info("Switched to Build Mode")
        return
      }
    }

    try {
      const created = await create({
        prompt: effectivePrompt,
        mode: effectiveMode,
      })
      toast.success(
        effectiveMode === "plan"
          ? "Workspace created in Plan Mode"
          : "Workspace created"
      )
      navigate(created.redirect_url)
    } catch (error) {
      console.log(error)
      toast.error(getApiErrorMessage(error, "Could not start workspace"))
    }
  }

  return (
    <>
      <Card className="w-full">
        <CardHeader className="items-center justify-items-center text-center">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            {mode === "plan" ? (
              <ListTodoIcon className="size-5" />
            ) : (
              <SparklesIcon className="size-5" />
            )}
          </span>
          <CardTitle className="text-2xl">
            {mode === "plan" ? "What do you want to plan?" : "What do you want to build?"}
          </CardTitle>
          <CardDescription>
            {mode === "plan"
              ? "Describe an app or architecture. We create a workspace and formulate an interactive execution plan first."
              : "Describe an app. We create a workspace from your prompt and start building."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              void startWorkspace(prompt)
            }}
          >
            {mode === "plan" && (
              <div className="flex items-center justify-between rounded-md bg-sky-500/10 px-3 py-1.5 text-xs text-sky-700 dark:text-sky-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <ListTodoIcon className="size-3.5" />
                  Plan Mode active — Workspace will research & create an implementation plan before writing code
                </span>
                <button
                  type="button"
                  onClick={() => setMode("build")}
                  className="text-[11px] underline underline-offset-2 opacity-80 hover:opacity-100 cursor-pointer"
                >
                  Switch to Build
                </button>
              </div>
            )}

            <div className="relative">
              {isSlashCommandOpen && (
                <SlashCommandMenu
                  query={prompt}
                  selectedIndex={selectedSlashIndex}
                  onSelect={handleSelectSlashCommand}
                />
              )}

              <InputGroup className="min-h-36">
                <InputGroupTextarea
                  id="build-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    mode === "plan"
                      ? "Plan Mode: Describe app architecture, requirements or design to research and plan (/build to switch)..."
                      : "A realtime chat app with rooms, typing indicators, and file uploads (type /plan for plan mode)…"
                  }
                  className="min-h-28 text-base"
                  disabled={creating}
                  onKeyDown={(e) => {
                    if (isSlashCommandOpen && matchingSlashCommands.length > 0) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault()
                        setSelectedSlashIndex((prev) => (prev + 1) % matchingSlashCommands.length)
                        return
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault()
                        setSelectedSlashIndex(
                          (prev) => (prev - 1 + matchingSlashCommands.length) % matchingSlashCommands.length
                        )
                        return
                      }
                      if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault()
                        const selected = matchingSlashCommands[selectedSlashIndex]
                        if (selected) {
                          handleSelectSlashCommand(selected)
                        }
                        return
                      }
                      if (e.key === "Escape") {
                        e.preventDefault()
                        setPrompt("")
                        return
                      }
                    }

                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      void startWorkspace(prompt)
                    }
                  }}
                />
                <InputGroupAddon align="block-end" className="justify-between border-t gap-2">
                  {/* Mode switcher pill */}
                  <div className="flex items-center rounded-md border border-border/70 bg-background/80 p-0.5 text-[11px] font-medium shadow-2xs">
                    <button
                      type="button"
                      disabled={creating}
                      onClick={() => setMode("build")}
                      className={cn(
                        "flex items-center gap-1 rounded px-2.5 py-1 transition-colors cursor-pointer",
                        mode === "build"
                          ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title="Build Mode: Agent directly writes and modifies project code"
                    >
                      <HammerIcon className="size-3" />
                      Build
                    </button>
                    <button
                      type="button"
                      disabled={creating}
                      onClick={() => setMode("plan")}
                      className={cn(
                        "flex items-center gap-1 rounded px-2.5 py-1 transition-colors cursor-pointer",
                        mode === "plan"
                          ? "bg-sky-600 text-white font-semibold shadow-2xs dark:bg-sky-500"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title="Plan Mode: Agent researches codebase and proposes a plan before editing"
                    >
                      <ListTodoIcon className="size-3" />
                      Plan
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <InputGroupButton
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={creating}
                      onClick={() => setImportOpen(true)}
                    >
                      <GitBranchIcon data-icon="inline-start" />
                      Import repo
                    </InputGroupButton>
                    <InputGroupButton
                      type="submit"
                      variant="default"
                      size="sm"
                      disabled={creating || !prompt.trim()}
                    >
                      {creating ? (
                        <Spinner data-icon="inline-start" />
                      ) : mode === "plan" ? (
                        <ListTodoIcon data-icon="inline-start" className="size-3.5" />
                      ) : (
                        <ArrowUpIcon data-icon="inline-start" />
                      )}
                      {mode === "plan" ? "Start planning" : "Start building"}
                    </InputGroupButton>
                  </div>
                </InputGroupAddon>
              </InputGroup>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3 sm:items-start">
          <p className="text-xs text-muted-foreground">Try a starting point</p>
          <div className="flex flex-wrap gap-2">
            {prompts.map((item) => (
              <Button
                key={item}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void startWorkspace(item)}
                disabled={creating}
              >
                {item}
              </Button>
            ))}
          </div>
        </CardFooter>
      </Card>
      <ImportGithubRepoDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  )
}
