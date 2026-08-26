import { useEffect } from "react"

import { AgentCreateChat } from "@/components/dashboard/AgentCreateChat"
import { DashboardHeader } from "@/components/dashboard/DashboardHeader"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAuthStore } from "@/stores/auth-store"
import { useWorkspaceListStore } from "@/stores/workspace-list-store"

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const fetchWorkspaces = useWorkspaceListStore((s) => s.fetchWorkspaces)

  useEffect(() => {
    void fetchWorkspaces()
  }, [fetchWorkspaces])

  const firstName = user?.name.split(" ")[0]

  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        <DashboardHeader />
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
          <div className="flex w-full max-w-2xl flex-col gap-8">
            <div className="flex flex-col gap-1 text-center">
              <h1 className="text-3xl font-medium tracking-tight">
                {firstName ? `Hey, ${firstName}` : "Hey"}
              </h1>
              <p className="text-muted-foreground">
                Start a new workspace, or reopen a session from the sidebar.
              </p>
            </div>
            <AgentCreateChat />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
