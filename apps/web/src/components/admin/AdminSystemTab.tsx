import {
  BoxIcon,
  CheckCircle2Icon,
  CpuIcon,
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

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return "0 GB"
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(decimals)} GB`
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(decimals)} MB`
}

export function AdminSystemTab({ stats, loading, onRefresh }: Props) {
  const env = stats?.environment || {}
  const res = stats?.system_resources

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">System & Environment</h2>
          <p className="text-sm text-muted-foreground">
            Low-level diagnostics, complete hardware telemetry, Docker engine configurations, and MongoDB status.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCwIcon className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Diagnostics
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Host Hardware & Resource Telemetry */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CpuIcon className="size-5 text-primary" />
                <div>
                  <CardTitle className="text-base">Host Machine Resource Telemetry</CardTitle>
                  <CardDescription>Real-time physical CPU load, RAM memory distribution, and storage utilization</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {res?.cpu.logical_cores ?? 1} Cores ({res?.cpu.physical_cores ?? 1} Physical)
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* CPU */}
            <div className="space-y-2 p-3 rounded-lg border bg-card">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">CPU Load</span>
                <span className="font-mono font-bold text-sm">{(res?.cpu.percent ?? 0).toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all rounded-full ${
                    (res?.cpu.percent ?? 0) > 85
                      ? "bg-destructive"
                      : (res?.cpu.percent ?? 0) > 65
                      ? "bg-amber-500"
                      : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, res?.cpu.percent ?? 0))}%` }}
                />
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Cores: {res?.cpu.logical_cores ?? 1}</span>
                <span>Physical: {res?.cpu.physical_cores ?? 1}</span>
              </div>
            </div>

            {/* RAM */}
            <div className="space-y-2 p-3 rounded-lg border bg-card">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Memory (RAM)</span>
                <span className="font-mono font-bold text-sm">{(res?.memory.percent ?? 0).toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all rounded-full ${
                    (res?.memory.percent ?? 0) > 85
                      ? "bg-destructive"
                      : (res?.memory.percent ?? 0) > 70
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, res?.memory.percent ?? 0))}%` }}
                />
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Used: {formatBytes(res?.memory.used_bytes ?? 0)}</span>
                <span>Total: {formatBytes(res?.memory.total_bytes ?? 0)}</span>
              </div>
            </div>

            {/* Disk */}
            <div className="space-y-2 p-3 rounded-lg border bg-card">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Storage (Disk)</span>
                <span className="font-mono font-bold text-sm">{(res?.disk.percent ?? 0).toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all rounded-full ${
                    (res?.disk.percent ?? 0) > 90
                      ? "bg-destructive"
                      : (res?.disk.percent ?? 0) > 75
                      ? "bg-amber-500"
                      : "bg-sky-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, res?.disk.percent ?? 0))}%` }}
                />
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Free: {formatBytes(res?.disk.free_bytes ?? 0)}</span>
                <span>Drive: {res?.disk.path || "/"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

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
              <span className="font-mono">
                {(() => {
                  const domain = (stats?.environment?.preview_base_domain as string) || "lvh.me"
                  return domain === "lvh.me" ? `*.${domain}:8000` : `*.${domain}`
                })()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
