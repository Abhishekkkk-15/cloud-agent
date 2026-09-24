import { useState } from "react"
import {
  FolderGit2Icon,
  MessageSquareIcon,
  MoreVerticalIcon,
  PlusIcon,
  QrCodeIcon,
  SearchIcon,
  Trash2Icon,
  PencilIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FolderPlusIcon,
  CpuIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ManageSidebarItemDialog,
  type ManageSidebarItemTarget,
} from "@/components/sidebar/ManageSidebarItemDialog"
import { useWorkspaceStore } from "@/stores/workspace-store"

export function DesktopSidebar({ onOpenPairModal }: { onOpenPairModal?: () => void }) {
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen)
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspace = useWorkspaceStore((s) => s.workspace)
  const activeSessionId = useWorkspaceStore((s) => s.activeSessionId)
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace)
  const switchSession = useWorkspaceStore((s) => s.switchSession)
  const createSessionForWorkspace = useWorkspaceStore(
    (s) => s.createSessionForWorkspace
  )
  const renameWorkspace = useWorkspaceStore((s) => s.renameWorkspace)
  const renameSession = useWorkspaceStore((s) => s.renameSession)
  const removeWorkspace = useWorkspaceStore((s) => s.removeWorkspace)
  const removeSession = useWorkspaceStore((s) => s.removeSession)

  const [search, setSearch] = useState("")
  const [collapsedWorkspaces, setCollapsedWorkspaces] = useState<Record<string, boolean>>({})
  const [manageTarget, setManageTarget] = useState<ManageSidebarItemTarget | null>(null)

  if (!sidebarOpen) return null

  const toggleCollapse = (wsId: string) => {
    setCollapsedWorkspaces((prev) => ({
      ...prev,
      [wsId]: !prev[wsId],
    }))
  }

  const handleCreateSession = async (wsId: string) => {
    await createSessionForWorkspace(wsId)
  }

  const handleCreateWorkspace = () => {
    const name = window.prompt("Enter new workspace name (e.g. backend-api):")
    if (!name || !name.trim()) return
    const id = `ws-${Date.now()}`
    const newWs = {
      id,
      title: name.trim(),
      user_id: "user-local",
      target_path: `D:/projects/${name.trim()}`,
      source_path: null,
      sandbox_id: null,
      is_active: true,
      initial_prompt: "",
      status: "ready" as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      frontend_port: null,
      backend_port: null,
      preview_url: null,
      sessions: [
        {
          id: `sess-${Date.now()}`,
          title: "Initial Session",
        },
      ],
    }
    useWorkspaceStore.setState((state) => ({
      workspaces: [...state.workspaces, newWs],
    }))
    switchWorkspace(id)
    toast.success(`Workspace "${name}" added`)
  }

  const handleSaveItem = async (name: string) => {
    if (!manageTarget) return
    if (manageTarget.kind === "workspace") {
      await renameWorkspace(manageTarget.workspaceId, name)
      toast.success("Workspace renamed")
    } else {
      await renameSession(manageTarget.workspaceId, manageTarget.sessionId, name)
      toast.success("Session renamed")
    }
  }

  const handleDeleteItem = async () => {
    if (!manageTarget) return
    if (manageTarget.kind === "workspace") {
      await removeWorkspace(manageTarget.workspaceId)
    } else {
      await removeSession(manageTarget.workspaceId, manageTarget.sessionId)
    }
  }

  return (
    <>
      <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-card text-xs select-none">
        {/* Header: Title and Search */}
        <div className="p-2.5 border-b space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Workspaces & Sessions
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleCreateWorkspace}
              className="size-5 hover:bg-muted"
              title="Add New Workspace"
            >
              <FolderPlusIcon className="size-3.5 text-muted-foreground" />
            </Button>
          </div>

          <div className="relative">
            <SearchIcon className="absolute left-2 top-2 size-3 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sessions…"
              className="h-7 pl-7 text-xs bg-muted/30"
            />
          </div>
        </div>

        {/* Workspaces & Nested Sessions Tree */}
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-3">
            {workspaces.map((ws) => {
              const wsId = ws.id ?? ""
              const isCurrentWs = activeWorkspace?.id === wsId
              const isCollapsed = collapsedWorkspaces[wsId]
              const matchingSessions = ws.sessions.filter((s) =>
                s.title.toLowerCase().includes(search.toLowerCase())
              )

              if (search && matchingSessions.length === 0) return null

              return (
                <div key={wsId} className="space-y-1">
                  {/* Workspace Row */}
                  <div
                    className={`group flex items-center justify-between rounded-md px-1.5 py-1 text-xs transition-colors ${
                      isCurrentWs
                        ? "bg-accent/60 font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        switchWorkspace(wsId)
                      }}
                      className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleCollapse(wsId)
                        }}
                        className="p-0.5 hover:bg-muted rounded"
                      >
                        {isCollapsed ? (
                          <ChevronRightIcon className="size-3 text-muted-foreground" />
                        ) : (
                          <ChevronDownIcon className="size-3 text-muted-foreground" />
                        )}
                      </button>

                      <FolderGit2Icon
                        className={`size-3.5 shrink-0 ${
                          isCurrentWs ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                      <span className="truncate">{ws.title}</span>
                    </button>

                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleCreateSession(wsId)}
                        className="size-5 hover:bg-muted"
                        title="New session in workspace"
                      >
                        <PlusIcon className="size-3 text-muted-foreground" />
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button
                              type="button"
                              className="size-5 flex items-center justify-center hover:bg-muted rounded cursor-pointer"
                            />
                          }
                        >
                          <MoreVerticalIcon className="size-3 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem
                            onClick={() =>
                              setManageTarget({
                                kind: "workspace",
                                workspaceId: wsId,
                                title: ws.title,
                              })
                            }
                            className="text-xs gap-1.5"
                          >
                            <PencilIcon className="size-3" />
                            <span>Rename</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setManageTarget({
                                kind: "workspace",
                                workspaceId: wsId,
                                title: ws.title,
                              })
                            }
                            className="text-xs gap-1.5 text-destructive focus:text-destructive"
                          >
                            <Trash2Icon className="size-3" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Sessions list */}
                  {!isCollapsed && (
                    <div className="ml-4 pl-1 border-l border-border/60 space-y-0.5">
                      {matchingSessions.map((session) => {
                        const isCurrentSession = activeSessionId === session.id
                        return (
                          <div
                            key={session.id}
                            className={`group flex items-center justify-between rounded px-2 py-1 text-[11px] transition-colors ${
                              isCurrentSession
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (!isCurrentWs) switchWorkspace(wsId)
                                switchSession(session.id)
                              }}
                              className="flex items-center gap-1.5 truncate flex-1 text-left cursor-pointer"
                            >
                              <MessageSquareIcon className="size-3 shrink-0" />
                              <span className="truncate">{session.title}</span>
                            </button>

                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <button
                                    type="button"
                                    className="size-4 opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-muted rounded cursor-pointer"
                                  />
                                }
                              >
                                <MoreVerticalIcon className="size-2.5 text-muted-foreground" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-32">
                                <DropdownMenuItem
                                  onClick={() =>
                                    setManageTarget({
                                      kind: "session",
                                      workspaceId: wsId,
                                      sessionId: session.id,
                                      title: session.title,
                                    })
                                  }
                                  className="text-xs gap-1.5"
                                >
                                  <PencilIcon className="size-3" />
                                  <span>Rename</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setManageTarget({
                                      kind: "session",
                                      workspaceId: wsId,
                                      sessionId: session.id,
                                      title: session.title,
                                    })
                                  }
                                  className="text-xs gap-1.5 text-destructive focus:text-destructive"
                                >
                                  <Trash2Icon className="size-3" />
                                  <span>Delete</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>

        {/* Footer: Local Daemon & WebRTC Pairing */}
        <div className="p-2.5 border-t bg-muted/20 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CpuIcon className="size-3.5 text-primary" />
              <span>Daemon PID 12480</span>
            </div>
            <Badge variant="outline" className="text-[9px] h-4 px-1 text-emerald-500 border-emerald-500/30">
              RTC Ready
            </Badge>
          </div>

          {onOpenPairModal && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenPairModal}
              className="w-full h-7 text-xs gap-1.5 bg-background shadow-xs hover:bg-muted"
            >
              <QrCodeIcon className="size-3.5 text-primary" />
              <span>Pair Phone or Web</span>
            </Button>
          )}
        </div>
      </aside>

      <ManageSidebarItemDialog
        target={manageTarget}
        onOpenChange={(open) => !open && setManageTarget(null)}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
      />
    </>
  )
}
