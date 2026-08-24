import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  FolderIcon,
  MessageSquareIcon,
  MoonIcon,
  SearchIcon,
  SunIcon,
} from "lucide-react"

import { sessionsForProject } from "@/data/mock-sessions"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Command,
} from "@/components/ui/command"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useTheme } from "@/components/theme-provider"
import { useProjectStore } from "@/stores/project-store"

export function DashboardHeader() {
  const navigate = useNavigate()
  const projects = useProjectStore((s) => s.projects)
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-4" />
      <Breadcrumb className="hidden sm:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Dashboard</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <InputGroup className="hidden w-64 sm:flex">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            readOnly
            placeholder="Search projects…"
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupText>
              <kbd className="rounded-sm border bg-muted px-1 font-sans text-[10px]">
                ⌘K
              </kbd>
            </InputGroupText>
          </InputGroupAddon>
        </InputGroup>
        <Button
          variant="ghost"
          size="icon-sm"
          className="sm:hidden"
          onClick={() => setOpen(true)}
          aria-label="Search"
        >
          <SearchIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </Button>
      </div>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Jump to a project or session"
      >
        <Command>
          <CommandInput placeholder="Search projects and sessions…" />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup heading="Projects">
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={project.name}
                  onSelect={() => {
                    setOpen(false)
                    navigate(`/workspace/${project.id}`)
                  }}
                >
                  <FolderIcon />
                  {project.name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Sessions">
              {projects.flatMap((project) =>
                sessionsForProject(project.id).map((session) => (
                  <CommandItem
                    key={session.id}
                    value={`${project.name} ${session.title}`}
                    onSelect={() => {
                      setOpen(false)
                      navigate(`/workspace/${project.id}?session=${session.id}`)
                    }}
                  >
                    <MessageSquareIcon />
                    {session.title}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {project.name}
                    </span>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </header>
  )
}
