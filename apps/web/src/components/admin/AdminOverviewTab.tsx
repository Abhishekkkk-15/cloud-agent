import { useState } from "react"
import {
  BoxIcon,
  CpuIcon,
  DatabaseIcon,
  FolderGit2Icon,
  LayersIcon,
  MessageSquareIcon,
  RefreshCwIcon,
  SparklesIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { pruneAdminContainers, seedDefaultModels } from "@/lib/api"
import { getApiErrorMessage } from "@/lib/http"
import type { AdminSystemStats } from "@cloud-agent/shared"

type Props = {
  stats: AdminSystemStats | null
  loading: boolean
  onRefresh: () => void
  onNavigateTab: (tab: string) => void
}

export function AdminOverviewTab({
  stats,
  loading,
  onRefresh,
  onNavigateTab,
}: Props) {
  const [pruning, setPruning] = useState(false)
  const [seeding, setSeeding] = useState(false)

  async function handlePrune() {
    setPruning(true)
    try {
      const res = await pruneAdminContainers()
      toast.success(
        `Pruned ${res.deleted_count || 0} stopped containers (${Math.round((res.space_reclaimed_bytes || 0) / 1024 / 1024)} MB reclaimed)`
      )
      onRefresh()
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to prune containers"))
    } finally {
      setPruning(false)
    }
  }

  async function handleSeedModels() {
    setSeeding(true)
    try {
      const res = await seedDefaultModels()
      toast.success(`Seeded default models (${res.seeded || 0} created)`)
      onRefresh()
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to seed default models"))
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">System Overview</h2>
          <p className="text-sm text-muted-foreground">
            Real-time status, infrastructure health, and service metrics.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrune}
            disabled={pruning || stats?.docker.status !== "online"}
          >
            <Trash2Icon className="size-3.5" />
            {pruning ? "Pruning..." : "Prune Inactive Containers"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedModels}
            disabled={seeding}
          >
            <SparklesIcon className="size-3.5" />
            {seeding ? "Seeding..." : "Seed Default Models"}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCwIcon className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card
          className="cursor-pointer transition-colors hover:border-primary/50"
          onClick={() => onNavigateTab("users")}
        >
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Users</span>
              <UsersIcon className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">
              {stats?.total_users ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-xs text-muted-foreground">Registered accounts</span>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-colors hover:border-primary/50"
          onClick={() => onNavigateTab("workspaces")}
        >
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Workspaces</span>
              <FolderGit2Icon className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">
              {stats?.total_workspaces ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-xs text-muted-foreground">Total cloud workspaces</span>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-colors hover:border-primary/50"
          onClick={() => onNavigateTab("containers")}
        >
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Containers</span>
              <BoxIcon className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">
              {stats?.docker.running_containers_count ?? 0}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / {stats?.docker.containers_count ?? 0}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-xs text-muted-foreground">Running / Total Docker</span>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-colors hover:border-primary/50"
          onClick={() => onNavigateTab("models")}
        >
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">AI Models</span>
              <CpuIcon className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">
              {stats?.active_models ?? 0}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / {stats?.total_models ?? 0}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-xs text-muted-foreground">Active LLM providers</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Sessions</span>
              <LayersIcon className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">
              {stats?.total_sessions ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-xs text-muted-foreground">Agent task sessions</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Messages</span>
              <MessageSquareIcon className="size-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">
              {stats?.total_messages ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <span className="text-xs text-muted-foreground">Chat messages stored</span>
          </CardContent>
        </Card>
      </div>

      {/* Infrastructure Health Status */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Docker Daemon Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <BoxIcon className="size-5 text-primary" />
              <div>
                <CardTitle className="text-base">Docker Sandbox Daemon</CardTitle>
                <CardDescription>Container engine runtime status</CardDescription>
              </div>
            </div>
            <Badge
              variant={
                stats?.docker.status === "online" ? "default" : "destructive"
              }
            >
              {stats?.docker.status === "online" ? "Online" : "Offline"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">Engine Version:</span>
              <span className="font-mono font-medium">
                {stats?.docker.version || "Unavailable"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">WSL Docker Host:</span>
              <span className="font-mono">
                {String(stats?.environment?.docker_wsl_ip || "Default pipe")}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">Active Sandboxes:</span>
              <span className="font-medium">
                {stats?.docker.running_containers_count ?? 0} running
              </span>
            </div>
            {stats?.docker.error ? (
              <div className="rounded-md bg-destructive/10 p-2 text-destructive">
                <span className="font-medium">Error:</span> {stats.docker.error}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* MongoDB Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <DatabaseIcon className="size-5 text-primary" />
              <div>
                <CardTitle className="text-base">MongoDB Database</CardTitle>
                <CardDescription>Document storage cluster connection</CardDescription>
              </div>
            </div>
            <Badge
              variant={
                stats?.mongo.status === "connected" ? "default" : "destructive"
              }
            >
              {stats?.mongo.status === "connected" ? "Connected" : "Disconnected"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">Database Name:</span>
              <span className="font-mono font-medium">
                {String(stats?.environment?.database_name || "cloud-agent")}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">Ping Latency:</span>
              <span className="font-mono font-medium">
                {stats?.mongo.ping_ms ?? 0} ms
              </span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="text-muted-foreground">Default LLM:</span>
              <span className="font-mono">
                {String(stats?.environment?.default_model || "gpt-5.6-luna")}
              </span>
            </div>
            {stats?.mongo.error ? (
              <div className="rounded-md bg-destructive/10 p-2 text-destructive">
                <span className="font-medium">Error:</span> {stats.mongo.error}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
