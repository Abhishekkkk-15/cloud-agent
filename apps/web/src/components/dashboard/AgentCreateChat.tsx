import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowUpIcon, SparklesIcon } from "lucide-react"
import { toast } from "sonner"

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

  async function startWorkspace(value: string) {
    const trimmed = value.trim()
    if (!trimmed || creating) return

    try {
      const created = await create({ prompt: trimmed })
      sessionStorage.setItem(`agent-seed:${created.workspace_id}`, trimmed)
      toast.success("Workspace created")
      navigate(created.redirect_url)
    } catch (error) {
      console.log(error)
      toast.error(getApiErrorMessage(error, "Could not start workspace"))
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="items-center justify-items-center text-center">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <SparklesIcon className="size-5" />
        </span>
        <CardTitle className="text-2xl">What do you want to build?</CardTitle>
        <CardDescription>
          Describe an app. We create a workspace from your prompt and open a
          session.
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
          <InputGroup className="min-h-36">
            <InputGroupTextarea
              id="build-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A realtime chat app with rooms, typing indicators, and file uploads…"
              className="min-h-28 text-base"
              disabled={creating}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void startWorkspace(prompt)
                }
              }}
            />
            <InputGroupAddon align="block-end" className="justify-end border-t">
              <InputGroupButton
                type="submit"
                variant="default"
                size="sm"
                disabled={creating || !prompt.trim()}
              >
                {creating ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <ArrowUpIcon data-icon="inline-start" />
                )}
                Start building
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
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
  )
}
