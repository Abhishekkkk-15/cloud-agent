import {
  BoxIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  NetworkIcon,
  RefreshCwIcon,
  ServerIcon,
  XCircleIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { AdminSystemStats } from "@cloud-agent/shared"

type Props = {
  stats: AdminSystemStats | null
  loading: boolean
  onRefresh: () => void
}

export function AdminSystemTab({ stats, loading, onRefresh }: Props) {
  const env = stats?.environment || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">System & Environment</h2>
          <p className="text-sm text-muted-foreground">
            Low-level diagnostics, Docker engine configurations, MongoDB status, and backend parameters.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCwIcon className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Diagnostics
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Core Infrastructure */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ServerIcon className="size-5 text-primary" />
              <div>
                <CardTitle className="text-base">Host & Runtime Environment</CardTitle>
                <CardDescription>Server operating system and Python runtime</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Operating System:</span>
              <span className="font-mono font-medium">{String(env.os || "N/A")}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Python Version:</span>
              <span className="font-mono font-medium">
                {String(env.python_version || "N/A")}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Autonomous Agent Mode:</span>
              <Badge variant="outline" className="font-mono">
                {String(env.autonomous_mode || "True")}
              </Badge>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Default Model ID:</span>
              <span className="font-mono font-medium">
                {String(env.default_model || "gpt-5.6-luna")}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Default Provider:</span>
              <span className="font-mono capitalize">
                {String(env.default_provider || "openai")}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Database Diagnostics */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DatabaseIcon className="size-5 text-primary" />
                <div>
                  <CardTitle className="text-base">MongoDB Database</CardTitle>
                  <CardDescription>Document storage & collection metrics</CardDescription>
                </div>
              </div>
              <Badge
                variant={
                  stats?.mongo.status === "connected" ? "default" : "destructive"
                }
                className="gap-1"
              >
                {stats?.mongo.status === "connected" ? (
                  <CheckCircle2Icon className="size-3" />
                ) : (
                  <XCircleIcon className="size-3" />
                )}
                {stats?.mongo.status === "connected" ? "Connected" : "Disconnected"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Database Name:</span>
              <span className="font-mono font-medium">
                {String(env.database_name || "cloud-agent")}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Ping Latency:</span>
              <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                {stats?.mongo.ping_ms ?? 0} ms
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Workspaces Collection:</span>
              <span className="font-mono">{stats?.total_workspaces ?? 0} documents</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Users Collection:</span>
              <span className="font-mono">{stats?.total_users ?? 0} documents</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Sessions & Messages:</span>
              <span className="font-mono">
                {stats?.total_sessions ?? 0} sessions, {stats?.total_messages ?? 0} messages
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Docker Engine Diagnostics */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BoxIcon className="size-5 text-primary" />
                <div>
                  <CardTitle className="text-base">Docker Engine & Sandbox</CardTitle>
                  <CardDescription>Container runtime & bind mounts</CardDescription>
                </div>
              </div>
              <Badge
                variant={
                  stats?.docker.status === "online" ? "default" : "destructive"
                }
                className="gap-1"
              >
                {stats?.docker.status === "online" ? (
                  <CheckCircle2Icon className="size-3" />
                ) : (
                  <XCircleIcon className="size-3" />
                )}
                {stats?.docker.status === "online" ? "Online" : "Offline"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Engine Version:</span>
              <span className="font-mono font-medium">
                {stats?.docker.version || "Unavailable"}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">WSL Docker Host:</span>
              <span className="font-mono">
                {String(env.docker_wsl_ip || "Default named pipe")}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Sandbox Mount Base:</span>
              <span className="font-mono break-all max-w-[240px] text-right">
                {String(env.sandbox_mount || "Not configured")}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Sandbox Image:</span>
              <span className="font-mono">node-python-lite</span>
            </div>
          </CardContent>
        </Card>

        {/* Network & Preview Ports */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <NetworkIcon className="size-5 text-primary" />
              <div>
                <CardTitle className="text-base">Networking & Port Allocator</CardTitle>
                <CardDescription>Dynamic host port allocation for previews</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Internal Frontend Port:</span>
              <span className="font-mono font-medium">4000/tcp</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Internal Backend Port:</span>
              <span className="font-mono font-medium">3000/tcp</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Host Port Range:</span>
              <span className="font-mono font-medium">30000 - 39999</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Wildcard Domain Proxy:</span>
              <span className="font-mono">*.lvh.me:8000</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
