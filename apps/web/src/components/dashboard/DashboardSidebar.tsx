import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  ChevronRightIcon,
  CloudIcon,
  FolderIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MessageSquareIcon,
  PlusIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { getApiErrorMessage } from "@/lib/http"
import { useAuthStore } from "@/stores/auth-store"
import { useWorkspaceListStore } from "@/stores/workspace-list-store"

export function DashboardSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const workspaces = useWorkspaceListStore((s) => s.workspaces)
  const loading = useWorkspaceListStore((s) => s.loading)
  const error = useWorkspaceListStore((s) => s.error)
  const creatingSessionFor = useWorkspaceListStore((s) => s.creatingSessionFor)
  const createSessionForWorkspace = useWorkspaceListStore(
    (s) => s.createSessionForWorkspace
  )
  const search = new URLSearchParams(location.search)
  const activeSession = search.get("session")
  const initials =
    user?.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2) ?? "CA"

  function focusComposer() {
    document.getElementById("build-prompt")?.focus()
  }

  async function handleNewSession(workspaceId: string) {
    try {
      const session = await createSessionForWorkspace(workspaceId)
      navigate(`/workspace/${workspaceId}?session=${session.id}`)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not create session"))
    }
  }

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/dashboard" />}
              isActive={location.pathname === "/dashboard"}
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <CloudIcon className="size-4" />
              </span>
              <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Cloud Agent</span>
                <span className="truncate text-xs text-muted-foreground">
                  Workspace
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location.pathname === "/dashboard"}
                  render={<Link to="/dashboard" />}
                  tooltip="New workspace"
                >
                  <LayoutDashboardIcon />
                  <span>New workspace</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
          <SidebarGroupAction title="New workspace" onClick={focusComposer}>
            <PlusIcon />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {error ? (
                <SidebarMenuItem>
                  <span className="px-2 py-1 text-xs text-muted-foreground">
                    {error}
                  </span>
                </SidebarMenuItem>
              ) : null}
              {loading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <SidebarMenuItem key={index}>
                      <SidebarMenuSkeleton showIcon />
                    </SidebarMenuItem>
                  ))
                : workspaces.length === 0 ? (
                    <SidebarMenuItem>
                      <span className="px-2 py-1 text-xs text-muted-foreground">
                        No workspaces yet. Describe something above to start.
                      </span>
                    </SidebarMenuItem>
                  ) : (
                    workspaces.map((workspace, index) => {
                    const workspaceId = workspace.id
                    if (!workspaceId) return null
                    return (
                      <Collapsible
                        key={workspaceId}
                        defaultOpen={index === 0}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger
                            render={<SidebarMenuButton />}
                          >
                            <FolderIcon />
                            <span
                              className="min-w-0 flex-1 truncate"
                              title={workspace.title}
                            >
                              {workspace.title}
                            </span>
                            <ChevronRightIcon className="ml-auto shrink-0 transition-transform group-data-open/collapsible:rotate-90" />
                          </CollapsibleTrigger>
                          <SidebarMenuBadge>
                            {workspace.sessions.length}
                          </SidebarMenuBadge>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {workspace.sessions.map((session) => (
                                <SidebarMenuSubItem key={session.id}>
                                  <SidebarMenuSubButton
                                    isActive={activeSession === session.id}
                                    render={
                                      <Link
                                        to={`/workspace/${workspaceId}?session=${session.id}`}
                                      />
                                    }
                                  >
                                    <MessageSquareIcon />
                                    <span
                                      className="min-w-0 flex-1 truncate"
                                      title={session.title}
                                    >
                                      {session.title}
                                    </span>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  disabled={creatingSessionFor === workspaceId}
                                  onClick={() => {
                                    void handleNewSession(workspaceId)
                                  }}
                                >
                                  <PlusIcon />
                                  <span>New session</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    )
                  })
                  )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<SidebarMenuButton size="lg" />}
              >
                <Avatar size="sm">
                  {user?.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                  ) : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {user?.name ?? "Guest"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user?.email ?? "Sign in"}
                  </span>
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    {user?.name}
                    <div className="font-normal text-muted-foreground">
                      {user?.email}
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                    <LayoutDashboardIcon />
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={signOut}>
                    <LogOutIcon />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
