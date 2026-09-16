import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  ExternalLinkIcon,
  FolderGit2Icon,
  RefreshCwIcon,
  SearchIcon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { deleteAdminWorkspace, getAdminWorkspaces, stopAdminWorkspace } from "@/lib/api"
import { getApiErrorMessage } from "@/lib/http"
import type { AdminWorkspace } from "@cloud-agent/shared"

export function AdminWorkspacesTab() {
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [busyWorkspaceId, setBusyWorkspaceId] = useState<string | null>(null)

  async function load(isSilent = false) {
    if (!isSilent) setLoading(true)
    try {
      const res = await getAdminWorkspaces({
        search: search.trim() || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
      })
      setWorkspaces(res.workspaces)
      setTotal(res.total)
    } catch (err) {
      if (!isSilent) {
        toast.error(getApiErrorMessage(err, "Failed to load workspaces"))
      }
    } finally {
      if (!isSilent) setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void load()
    }, 300)
    return () => clearTimeout(timer)
  }, [search, statusFilter])

  async function handleStop(ws: AdminWorkspace) {
    setBusyWorkspaceId(ws.id)
    try {
      await stopAdminWorkspace(ws.id)
      toast.success(`Stopped workspace "${ws.title}"`)
      await load(true)
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to stop workspace"))
    } finally {
      setBusyWorkspaceId(null)
    }
  }

  async function handleDelete(ws: AdminWorkspace) {
    if (!confirm(`Are you sure you want to permanently delete workspace "${ws.title}"?`))
      return
    setBusyWorkspaceId(ws.id)
    try {
      await deleteAdminWorkspace(ws.id)
      toast.success(`Workspace "${ws.title}" deleted`)
      await load(true)
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to delete workspace"))
    } finally {
      setBusyWorkspaceId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Workspaces Oversight</h2>
          <p className="text-sm text-muted-foreground">
            Monitor and control cloud workspaces across all users, inspect allocated ports, and terminate stuck sandboxes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-2.5 py-1">
            Total Workspaces: {total}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCwIcon className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by workspace title, path, user ID, or container ID..."
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
          <option value="ready">Ready</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed / Stopped</option>
        </select>
      </div>

      {/* Workspaces Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Spinner />
            </div>
          ) : workspaces.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center">
              <FolderGit2Icon className="size-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium">No workspaces found</p>
              <p className="text-xs text-muted-foreground">
                Try clearing your search query or selecting a different status filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Workspace</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Container ID</th>
                    <th className="px-4 py-3">Ports</th>
                    <th className="px-4 py-3">Sessions</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {workspaces.map((ws) => {
                    const isBusy = busyWorkspaceId === ws.id
                    const isRunning = ws.status === "running" || ws.status === "ready"
                    return (
                      <tr key={ws.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">{ws.title}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {ws.github_repo_full_name ? (
                              <span>GitHub: {ws.github_repo_full_name}</span>
                            ) : (
                              <span>Origin: {ws.workspace_origin || "template"}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">
                            {ws.user_name || "Unknown"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {ws.user_email || ws.user_id}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              isRunning
                                ? "default"
                                : ws.status === "pending"
                                ? "secondary"
                                : "destructive"
                            }
                            className={
                              isRunning
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 capitalize"
                                : "capitalize"
                            }
                          >
                            {ws.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {ws.sandbox_id ? (
                            <span className="truncate max-w-[120px] inline-block font-mono">
                              {ws.sandbox_id.slice(0, 12)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">None</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                          <div>Frontend: {ws.frontend_port || "—"}</div>
                          <div>Backend: {ws.backend_port || "—"}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {ws.sessions_count} sessions
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {ws.created_at ? new Date(ws.created_at).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Open Workspace"
                              render={
                                <Link
                                  to={`/workspace/${ws.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                />
                              }
                            >
                              <ExternalLinkIcon className="size-3.5" />
                            </Button>
                            {isRunning && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Stop Workspace"
                                onClick={() => handleStop(ws)}
                                disabled={isBusy}
                              >
                                <SquareIcon className="size-3.5 text-amber-500" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Delete Workspace"
                              onClick={() => handleDelete(ws)}
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
    </div>
  )
}
