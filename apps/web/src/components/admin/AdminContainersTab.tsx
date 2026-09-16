import { useEffect, useState } from "react"
import {
  AlertTriangleIcon,
  BoxIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  PlayIcon,
  RefreshCwIcon,
  RotateCwIcon,
  SaveIcon,
  SearchIcon,
  SlidersIcon,
  SquareIcon,
  TerminalIcon,
  Trash2Icon,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  getAdminContainers,
  getAdminSandboxConfig,
  pruneAdminContainers,
  removeAdminContainer,
  restartAdminContainer,
  startAdminContainer,
  stopAdminContainer,
  updateAdminSandboxConfig,
} from "@/lib/api"
import { getApiErrorMessage } from "@/lib/http"
import type { AdminContainer, AdminSandboxConfig } from "@cloud-agent/shared"

import { ContainerInspectDialog } from "./ContainerInspectDialog"
import { ContainerLogsDialog } from "./ContainerLogsDialog"

export function AdminContainersTab() {
  const [containers, setContainers] = useState<AdminContainer[]>([])
  const [dockerAvailable, setDockerAvailable] = useState<boolean>(true)
  const [dockerError, setDockerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyActionId, setBusyActionId] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [autoRefresh, setAutoRefresh] = useState(false)

  const [inspectContainer, setInspectContainer] = useState<AdminContainer | null>(null)
  const [logsContainer, setLogsContainer] = useState<AdminContainer | null>(null)

  const [showLimitsCard, setShowLimitsCard] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [sandboxConfig, setSandboxConfig] = useState<AdminSandboxConfig>({
    memory_limit_mb: 2048,
    cpu_limit: 2.0,
    pids_limit: 500,
    memory_swap_limit_mb: -1,
    apply_to_running: false,
  })

  async function loadConfig() {
    try {
      const cfg = await getAdminSandboxConfig()
      setSandboxConfig(cfg)
    } catch {
      // Keep defaults if error
    }
  }

  async function handleSaveSandboxConfig() {
    setSavingConfig(true)
    try {
      const updated = await updateAdminSandboxConfig(sandboxConfig)
      setSandboxConfig(updated)
      toast.success(
        sandboxConfig.apply_to_running
          ? "Sandbox limits saved and applied to running containers"
          : "Sandbox limits saved successfully"
      )
      await load(true)
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to save sandbox resource limits"))
    } finally {
      setSavingConfig(false)
    }
  }

  async function load(isSilent = false) {
    if (!isSilent) setLoading(true)
    try {
      const res = await getAdminContainers()
      setContainers(res.containers || [])
      setDockerAvailable(res.docker_available)
      setDockerError(res.docker_error || null)
    } catch (err) {
      if (!isSilent) {
        toast.error(getApiErrorMessage(err, "Failed to load containers"))
      }
    } finally {
      if (!isSilent) setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    void loadConfig()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      void load(true)
    }, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  async function handleStart(id: string) {
    setBusyActionId(id)
    try {
      await startAdminContainer(id)
      toast.success("Container started")
      await load(true)
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to start container"))
    } finally {
      setBusyActionId(null)
    }
  }

  async function handleStop(id: string) {
    setBusyActionId(id)
    try {
      await stopAdminContainer(id)
      toast.success("Container stopped")
      await load(true)
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to stop container"))
    } finally {
      setBusyActionId(null)
    }
  }

  async function handleRestart(id: string) {
    setBusyActionId(id)
    try {
      await restartAdminContainer(id)
      toast.success("Container restarted")
      await load(true)
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to restart container"))
    } finally {
      setBusyActionId(null)
    }
  }

  async function handleRemove(id: string) {
    if (!confirm("Are you sure you want to force remove this container?")) return
    setBusyActionId(id)
    try {
      await removeAdminContainer(id)
      toast.success("Container removed")
      await load(true)
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to remove container"))
    } finally {
      setBusyActionId(null)
    }
  }

  async function handlePrune() {
    if (!confirm("Prune all stopped/exited containers?")) return
    setLoading(true)
    try {
      const res = await pruneAdminContainers()
      toast.success(`Pruned ${res.deleted_count || 0} stopped containers`)
      await load(true)
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to prune containers"))
    } finally {
      setLoading(false)
    }
  }

  const filtered = containers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.image.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      (c.workspace_id && c.workspace_id.toLowerCase().includes(search.toLowerCase()))
    const matchesStatus =
      statusFilter === "all" ? true : c.status.toLowerCase() === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Docker Containers</h2>
          <p className="text-sm text-muted-foreground">
            Manage active sandbox containers, view logs, inspect ports, and stop/restart sandboxes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showLimitsCard ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowLimitsCard(!showLimitsCard)}
          >
            <SlidersIcon className="size-3.5" />
            Resource Limits
            {showLimitsCard ? (
              <ChevronUpIcon className="size-3.5" />
            ) : (
              <ChevronDownIcon className="size-3.5" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrune}
            disabled={loading || !dockerAvailable}
          >
            <Trash2Icon className="size-3.5" />
            Prune Stopped
          </Button>
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCwIcon className={`size-3.5 ${autoRefresh ? "animate-spin" : ""}`} />
            {autoRefresh ? "Live Auto-Refresh" : "Auto-Refresh"}
          </Button>
          <Button variant="default" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCwIcon className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Resource Limits Card */}
      {showLimitsCard && (
        <Card className="border-primary/20 bg-muted/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <SlidersIcon className="size-4 text-primary" />
                  Sandbox Container Resource Limits
                </CardTitle>
                <CardDescription className="text-xs">
                  Constrain RAM, CPU cores, and process limits for agent sandboxes so they do not overuse the host machine.
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {sandboxConfig.memory_limit_mb} MB RAM • {sandboxConfig.cpu_limit} CPUs • {sandboxConfig.pids_limit} PIDs
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* RAM Limit */}
              <div className="space-y-2">
                <Label htmlFor="mem-limit" className="text-xs font-semibold">
                  Memory Limit (MB)
                </Label>
                <Input
                  id="mem-limit"
                  type="number"
                  min={256}
                  max={65536}
                  step={256}
                  value={sandboxConfig.memory_limit_mb}
                  onChange={(e) =>
                    setSandboxConfig({
                      ...sandboxConfig,
                      memory_limit_mb: Number(e.target.value) || 2048,
                    })
                  }
                  className="h-8 text-xs font-mono"
                />
                <div className="flex flex-wrap gap-1">
                  {[1024, 2048, 4096, 8192].map((mb) => (
                    <Button
                      key={mb}
                      type="button"
                      variant={sandboxConfig.memory_limit_mb === mb ? "secondary" : "outline"}
                      size="xs"
                      className="text-[10px] h-6 px-1.5"
                      onClick={() =>
                        setSandboxConfig({ ...sandboxConfig, memory_limit_mb: mb })
                      }
                    >
                      {mb / 1024} GB
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Container memory cap. Exceeding triggers Linux OOM killer.
                </p>
              </div>

              {/* CPU Limit */}
              <div className="space-y-2">
                <Label htmlFor="cpu-limit" className="text-xs font-semibold">
                  CPU Limit (Cores)
                </Label>
                <Input
                  id="cpu-limit"
                  type="number"
                  min={0.25}
                  max={64}
                  step={0.25}
                  value={sandboxConfig.cpu_limit}
                  onChange={(e) =>
                    setSandboxConfig({
                      ...sandboxConfig,
                      cpu_limit: Number(e.target.value) || 2.0,
                    })
                  }
                  className="h-8 text-xs font-mono"
                />
                <div className="flex flex-wrap gap-1">
                  {[1.0, 2.0, 4.0, 8.0].map((cores) => (
                    <Button
                      key={cores}
                      type="button"
                      variant={sandboxConfig.cpu_limit === cores ? "secondary" : "outline"}
                      size="xs"
                      className="text-[10px] h-6 px-1.5"
                      onClick={() =>
                        setSandboxConfig({ ...sandboxConfig, cpu_limit: cores })
                      }
                    >
                      {cores} {cores === 1 ? "Core" : "Cores"}
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Fractional or whole CPU cores dedicated to each sandbox container.
                </p>
              </div>

              {/* PIDs Limit */}
              <div className="space-y-2">
                <Label htmlFor="pids-limit" className="text-xs font-semibold">
                  Max Process Count (PIDs)
                </Label>
                <Input
                  id="pids-limit"
                  type="number"
                  min={50}
                  max={10000}
                  step={50}
                  value={sandboxConfig.pids_limit}
                  onChange={(e) =>
                    setSandboxConfig({
                      ...sandboxConfig,
                      pids_limit: Number(e.target.value) || 500,
                    })
                  }
                  className="h-8 text-xs font-mono"
                />
                <div className="flex flex-wrap gap-1">
                  {[250, 500, 1000].map((pids) => (
                    <Button
                      key={pids}
                      type="button"
                      variant={sandboxConfig.pids_limit === pids ? "secondary" : "outline"}
                      size="xs"
                      className="text-[10px] h-6 px-1.5"
                      onClick={() =>
                        setSandboxConfig({ ...sandboxConfig, pids_limit: pids })
                      }
                    >
                      {pids} PIDs
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Prevents fork-bomb vulnerabilities and runaway spawned processes.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2 border-t sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="apply-running"
                  checked={sandboxConfig.apply_to_running ?? false}
                  onCheckedChange={(checked) =>
                    setSandboxConfig({ ...sandboxConfig, apply_to_running: checked })
                  }
                />
                <Label htmlFor="apply-running" className="text-xs cursor-pointer">
                  Update active / running sandbox containers immediately
                </Label>
              </div>

              <Button
                size="sm"
                onClick={handleSaveSandboxConfig}
                disabled={savingConfig}
              >
                {savingConfig ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <SaveIcon className="size-3.5" />
                )}
                Save Configuration
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Docker Offline Warning Banner */}
      {!dockerAvailable && (
        <Card className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangleIcon className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-semibold text-sm">Docker Daemon is Offline</h4>
              <p className="text-xs leading-relaxed text-muted-foreground">
                The API cannot reach the Docker socket or WSL Docker daemon ({dockerError || "daemon unreachable"}).
                Make sure Docker Desktop is running, or if using WSL, verify that the daemon is listening on the configured port.
              </p>
              <div className="pt-2">
                <Button variant="outline" size="sm" onClick={() => void load()}>
                  Retry Connection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by container name, image, ID, or workspace..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="running">Running</option>
          <option value="exited">Exited / Stopped</option>
          <option value="paused">Paused</option>
        </select>
      </div>

      {/* Containers Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Spinner />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center">
              <BoxIcon className="size-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium">No containers found</p>
              <p className="text-xs text-muted-foreground">
                {dockerAvailable
                  ? "No matching Docker sandbox containers exist."
                  : "Docker is currently offline."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Container</th>
                    <th className="px-4 py-3">Image</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Ports</th>
                    <th className="px-4 py-3">Workspace ID</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((c) => {
                    const isBusy = busyActionId === c.id
                    const isRunning = c.status.toLowerCase() === "running"
                    return (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{c.name}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {c.short_id}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {c.image}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              isRunning
                                ? "default"
                                : c.status === "exited"
                                ? "outline"
                                : "destructive"
                            }
                            className={
                              isRunning
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                : ""
                            }
                          >
                            {c.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {Object.keys(c.ports).length > 0 ? (
                            <div className="flex flex-col gap-0.5 font-mono text-[11px]">
                              {Object.entries(c.ports)
                                .slice(0, 2)
                                .map(([cp, hp]) => (
                                  <span key={cp} className="text-muted-foreground">
                                    {cp}&rarr;{String(hp)}
                                  </span>
                                ))}
                              {Object.keys(c.ports).length > 2 && (
                                <span className="text-[10px] text-muted-foreground">
                                  +{Object.keys(c.ports).length - 2} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {c.workspace_id ? (
                            <span className="truncate max-w-[120px] inline-block">
                              {c.workspace_id}
                            </span>
                          ) : (
                            "N/A"
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.created ? new Date(c.created).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="View Container Logs"
                              onClick={() => setLogsContainer(c)}
                            >
                              <TerminalIcon className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Inspect JSON Metadata"
                              onClick={() => setInspectContainer(c)}
                            >
                              <EyeIcon className="size-3.5" />
                            </Button>
                            {isRunning ? (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Stop Container"
                                onClick={() => handleStop(c.id)}
                                disabled={isBusy}
                              >
                                <SquareIcon className="size-3.5 text-amber-500" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Start Container"
                                onClick={() => handleStart(c.id)}
                                disabled={isBusy}
                              >
                                <PlayIcon className="size-3.5 text-emerald-500" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Restart Container"
                              onClick={() => handleRestart(c.id)}
                              disabled={isBusy}
                            >
                              <RotateCwIcon className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Remove Container"
                              onClick={() => handleRemove(c.id)}
                              disabled={isBusy}
                            >
                              <Trash2Icon className="size-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ContainerLogsDialog
        container={logsContainer}
        onClose={() => setLogsContainer(null)}
      />
      <ContainerInspectDialog
        container={inspectContainer}
        onClose={() => setInspectContainer(null)}
      />
    </div>
  )
}
