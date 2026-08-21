import { useEffect } from "react"
import { SearchIcon, FolderOpenIcon } from "lucide-react"

import { AgentCreateChat } from "@/components/dashboard/AgentCreateChat"
import { ProjectCard } from "@/components/dashboard/ProjectCard"
import { AppHeader } from "@/components/layout/AppHeader"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthStore } from "@/stores/auth-store"
import { useProjectStore } from "@/stores/project-store"

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const projects = useProjectStore((s) => s.projects)
  const loading = useProjectStore((s) => s.loading)
  const query = useProjectStore((s) => s.query)
  const error = useProjectStore((s) => s.error)
  const setQuery = useProjectStore((s) => s.setQuery)
  const fetchProjects = useProjectStore((s) => s.fetchProjects)

  useEffect(() => {
    void fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void fetchProjects(query)
    }, 250)
    return () => window.clearTimeout(handle)
  }, [query, fetchProjects])

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-medium tracking-tight">
            Hey{user ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Chat with the agent to start a project, or reopen one below.
          </p>
        </div>

        <AgentCreateChat />

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
              Your projects
            </h2>
            <InputGroup className="max-w-sm">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search projects…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </InputGroup>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Could not load projects</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderOpenIcon />
                </EmptyMedia>
                <EmptyTitle>No projects yet</EmptyTitle>
                <EmptyDescription>
                  Describe something above to create your first workspace.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
