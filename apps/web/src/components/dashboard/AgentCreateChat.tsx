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
import { useProjectStore } from "@/stores/project-store"

function slugify(text: string) {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
  return base || `project-${Date.now().toString(36)}`
}

const prompts = [
  "Habit tracker in React",
  "Flask notes API with JWT",
  "SaaS landing page",
  "Go folder-watcher CLI",
]

export function AgentCreateChat() {
  const navigate = useNavigate()
  const create = useProjectStore((s) => s.create)
  const creating = useProjectStore((s) => s.creating)
  const [prompt, setPrompt] = useState("")

  async function startProject(value: string) {
    const trimmed = value.trim()
    if (!trimmed || creating) return

    const name = slugify(trimmed)
    try {
      const project = await create({
        name,
        description: trimmed,
        language: "typescript",
        visibility: "private",
        template: "react-vite",
      })
      sessionStorage.setItem(`agent-seed:${project.id}`, trimmed)
      toast.success("Project created")
      navigate(`/workspace/${project.id}`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not start project"
      )
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
          Describe an app. The agent opens a workspace and starts a session.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void startProject(prompt)
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
                  void startProject(prompt)
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
              onClick={() => void startProject(item)}
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
