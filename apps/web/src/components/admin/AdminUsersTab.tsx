import { useEffect, useState } from "react"
import {
  Edit2Icon,
  FolderGit2Icon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import {
  deleteAdminUser,
  getAdminUsers,
  updateAdminUserRole,
  updateAdminUserStatus,
} from "@/lib/api"
import { getApiErrorMessage } from "@/lib/http"
import { useAuthStore } from "@/stores/auth-store"
import type { AdminUser } from "@cloud-agent/shared"

import { EditUserDialog } from "./EditUserDialog"

export function AdminUsersTab() {
  const currentUser = useAuthStore((s) => s.user)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [planFilter, setPlanFilter] = useState("all")

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  async function load(isSilent = false) {
    if (!isSilent) setLoading(true)
    try {
      const res = await getAdminUsers({
        search: search.trim() || undefined,
        role: roleFilter === "all" ? undefined : roleFilter,
        plan: planFilter === "all" ? undefined : planFilter,
      })
      setUsers(res.users)
      setTotal(res.total)
    } catch (err) {
      if (!isSilent) {
        toast.error(getApiErrorMessage(err, "Failed to load users"))
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
  }, [search, roleFilter, planFilter])

  async function handleToggleRole(user: AdminUser) {
    if (user.id === currentUser?.id) {
      toast.error("You cannot change your own role")
      return
    }
    const nextRole = user.role === "admin" ? "user" : "admin"
    setBusyUserId(user.id)
    try {
      await updateAdminUserRole(user.id, nextRole)
      toast.success(`Updated ${user.name}'s role to ${nextRole}`)
      await load(true)
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update user role"))
    } finally {
      setBusyUserId(null)
    }
  }

  async function handleToggleActive(user: AdminUser) {
    if (user.id === currentUser?.id) {
      toast.error("You cannot deactivate your own account")
      return
    }
    setBusyUserId(user.id)
    try {
      await updateAdminUserStatus(user.id, !user.is_active)
      toast.success(
        `User ${user.name} is now ${!user.is_active ? "active" : "disabled"}`
      )
      await load(true)
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update user status"))
    } finally {
      setBusyUserId(null)
    }
  }

  async function handleDelete(user: AdminUser) {
    if (user.id === currentUser?.id) {
      toast.error("You cannot delete your own account")
      return
    }
    if (!confirm(`Are you sure you want to permanently delete user "${user.name}" (${user.email})?`))
      return
    setBusyUserId(user.id)
    try {
      await deleteAdminUser(user.id)
      toast.success(`User ${user.name} deleted`)
      await load(true)
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to delete user"))
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Users Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage user accounts, grant administrator privileges, configure subscription plans, and monitor workspace usage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-2.5 py-1">
            Total Users: {total}
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
            placeholder="Search by name, email, or username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All Roles</option>
          <option value="admin">Admins</option>
          <option value="user">Users</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="hacker">Hacker</option>
          <option value="pro">Pro</option>
        </select>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Spinner />
            </div>
          ) : users.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center">
              <UsersIcon className="size-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium">No users found</p>
              <p className="text-xs text-muted-foreground">
                Try adjusting your search query or filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Active</th>
                    <th className="px-4 py-3">Usage</th>
                    <th className="px-4 py-3">GitHub</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((u) => {
                    const isBusy = busyUserId === u.id
                    const isSelf = u.id === currentUser?.id
                    return (
                      <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8">
                              {u.avatarUrl ? (
                                <AvatarImage src={u.avatarUrl} alt={u.name} />
                              ) : null}
                              <AvatarFallback>
                                {u.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                <span>{u.name}</span>
                                {isSelf && (
                                  <span className="text-[10px] text-muted-foreground">(You)</span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {u.role === "admin" ? (
                            <Badge className="bg-primary/15 text-primary border-primary/30 gap-1">
                              <ShieldCheckIcon className="size-3" />
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="outline">User</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              u.plan === "pro"
                                ? "default"
                                : u.plan === "hacker"
                                ? "secondary"
                                : "outline"
                            }
                            className="capitalize"
                          >
                            {u.plan}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Switch
                            checked={u.is_active}
                            onCheckedChange={() => handleToggleActive(u)}
                            disabled={isBusy || isSelf}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <FolderGit2Icon className="size-3 text-muted-foreground" />
                            <span>{u.workspaces_count} workspaces</span>
                          </div>
                          <div className="text-[10px]">
                            {u.sessions_count} sessions
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {u.githubConnected ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                              @{u.githubLogin || "connected"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleToggleRole(u)}
                              disabled={isBusy || isSelf}
                            >
                              {u.role === "admin" ? "Demote" : "Promote"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Edit User"
                              onClick={() => setEditingUser(u)}
                              disabled={isBusy}
                            >
                              <Edit2Icon className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Delete User"
                              onClick={() => handleDelete(u)}
                              disabled={isBusy || isSelf}
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

      {/* Edit User Modal */}
      <EditUserDialog
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSuccess={() => void load(true)}
      />
    </div>
  )
}
