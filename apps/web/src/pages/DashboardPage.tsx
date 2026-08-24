import { useEffect } from "react"

import { AgentCreateChat } from "@/components/dashboard/AgentCreateChat"
import { DashboardHeader } from "@/components/dashboard/DashboardHeader"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useAuthStore } from "@/stores/auth-store"
import { useProjectStore } from "@/stores/project-store"

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const fetchProjects = useProjectStore((s) => s.fetchProjects)

  useEffect(() => {
    void fetchProjects()
  }, [fetchProjects])

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
                Start a new project, or reopen a session from the sidebar.
              </p>
            </div>
            <AgentCreateChat />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
