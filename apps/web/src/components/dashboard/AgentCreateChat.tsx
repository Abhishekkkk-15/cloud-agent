import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowUpIcon, SparklesIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
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
  "Build a habit tracker with React and local storage",
  "Create a Flask API for notes with JWT auth",
  "Make a landing page for a SaaS analytics tool",
  "Scaffold a Go CLI that watches a folder",
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
    <div className="flex w-full flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <SparklesIcon className="size-4" />
        </span>
        <div>
          <h2 className="text-base font-medium">What do you want to build?</h2>
          <p className="text-sm text-muted-foreground">
            Describe an app and the agent opens a workspace for it.
          </p>
        </div>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void startProject(prompt)
        }}
      >
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. A realtime chat app with rooms and typing indicators…"
          rows={4}
          className="min-h-28 resize-none text-base"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              void startProject(prompt)
            }
          }}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Mock agent flow — no backend required
          </p>
          <Button type="submit" disabled={creating || !prompt.trim()}>
            {creating ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ArrowUpIcon data-icon="inline-start" />
            )}
            Start building
          </Button>
        </div>
      </form>

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
    </div>
  )
}
