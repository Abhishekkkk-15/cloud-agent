import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  BotIcon,
  BoxIcon,
  CoinsIcon,
  CpuIcon,
  FolderGit2Icon,
  LayoutDashboardIcon,
  ServerIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react"

import { AdminAgentTab } from "@/components/admin/AdminAgentTab"
import { AdminContainersTab } from "@/components/admin/AdminContainersTab"
import { AdminCostsTab } from "@/components/admin/AdminCostsTab"
import { AdminModelsTab } from "@/components/admin/AdminModelsTab"
import { AdminOverviewTab } from "@/components/admin/AdminOverviewTab"
import { AdminSystemTab } from "@/components/admin/AdminSystemTab"
import { AdminUsersTab } from "@/components/admin/AdminUsersTab"
import { AdminWorkspacesTab } from "@/components/admin/AdminWorkspacesTab"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { Badge } from "@/components/ui/badge"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { getAdminStats } from "@/lib/api"
import { useAuthStore } from "@/stores/auth-store"
import type { AdminSystemStats } from "@cloud-agent/shared"

export function AdminPage() {
  const user = useAuthStore((s) => s.user)
  const [searchParams, setSearchParams] = useSearchParams()
  const currentTab = searchParams.get("tab") || "overview"

  const [stats, setStats] = useState<AdminSystemStats | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchStats() {
    setLoading(true)
    try {
      const data = await getAdminStats()
      setStats(data)
    } catch {
      // Handled silently; individual tabs fetch their own data
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchStats()
  }, [])

  function handleTabChange(tab: string) {
    searchParams.set("tab", tab)
    setSearchParams(searchParams)
  }

  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4" />
            <Breadcrumb className="hidden sm:block">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <span className="text-muted-foreground">Admin</span>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="flex items-center gap-1.5 font-medium">
                    <ShieldCheckIcon className="size-4 text-primary" />
                    Management Console
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden sm:inline-flex items-center gap-1 text-xs">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Admin: {user?.name}
            </Badge>
            <ThemeSwitcher />
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full space-y-6">
            <div className="overflow-x-auto pb-1">
              <TabsList className="h-9 w-full justify-start sm:w-auto">
                <TabsTrigger value="overview" className="gap-1.5 text-xs">
                  <LayoutDashboardIcon className="size-3.5" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="containers" className="gap-1.5 text-xs">
                  <BoxIcon className="size-3.5" />
                  Containers
                  {stats?.docker?.running_containers_count ? (
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">
                      {stats.docker.running_containers_count}
                    </Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="models" className="gap-1.5 text-xs">
                  <CpuIcon className="size-3.5" />
                  AI Models
                </TabsTrigger>
                <TabsTrigger value="agent" className="gap-1.5 text-xs">
                  <BotIcon className="size-3.5" />
                  Agent Config
                </TabsTrigger>
                <TabsTrigger value="costs" className="gap-1.5 text-xs">
                  <CoinsIcon className="size-3.5" />
                  Costs & Budgets
                </TabsTrigger>
                <TabsTrigger value="users" className="gap-1.5 text-xs">
                  <UsersIcon className="size-3.5" />
                  Users
                  {stats?.total_users ? (
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 h-4">
                      {stats.total_users}
                    </Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="workspaces" className="gap-1.5 text-xs">
                  <FolderGit2Icon className="size-3.5" />
                  Workspaces
                </TabsTrigger>
                <TabsTrigger value="system" className="gap-1.5 text-xs">
                  <ServerIcon className="size-3.5" />
                  System & Health
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="mt-0 outline-none">
              <AdminOverviewTab
                stats={stats}
                loading={loading}
                onRefresh={fetchStats}
                onNavigateTab={handleTabChange}
              />
            </TabsContent>

            <TabsContent value="containers" className="mt-0 outline-none">
              <AdminContainersTab />
            </TabsContent>

            <TabsContent value="models" className="mt-0 outline-none">
              <AdminModelsTab />
            </TabsContent>

            <TabsContent value="agent" className="mt-0 outline-none">
              <AdminAgentTab />
            </TabsContent>

            <TabsContent value="costs" className="mt-0 outline-none">
              <AdminCostsTab />
            </TabsContent>

            <TabsContent value="users" className="mt-0 outline-none">
              <AdminUsersTab />
            </TabsContent>

            <TabsContent value="workspaces" className="mt-0 outline-none">
              <AdminWorkspacesTab />
            </TabsContent>

            <TabsContent value="system" className="mt-0 outline-none">
              <AdminSystemTab stats={stats} loading={loading} onRefresh={fetchStats} />
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
