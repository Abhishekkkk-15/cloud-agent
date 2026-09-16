import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  updateAdminUserPlan,
  updateAdminUserRole,
  updateAdminUserStatus,
} from "@/lib/api"
import { getApiErrorMessage } from "@/lib/http"
import type { AdminUser } from "@cloud-agent/shared"

type Props = {
  user: AdminUser | null
  onClose: () => void
  onSuccess: () => void
}

export function EditUserDialog({ user, onClose, onSuccess }: Props) {
  const [busy, setBusy] = useState(false)
  const [role, setRole] = useState<"user" | "admin">("user")
  const [plan, setPlan] = useState<"free" | "hacker" | "pro">("free")
  const [isActive, setIsActive] = useState<boolean>(true)

  useEffect(() => {
    if (user) {
      setRole(user.role)
      setPlan(user.plan)
      setIsActive(user.is_active)
    }
  }, [user])

  async function handleSave() {
    if (!user) return
    setBusy(true)
    try {
      if (role !== user.role) {
        await updateAdminUserRole(user.id, role)
      }
      if (plan !== user.plan) {
        await updateAdminUserPlan(user.id, plan)
      }
      if (isActive !== user.is_active) {
        await updateAdminUserStatus(user.id, isActive)
      }
      toast.success(`User ${user.name} updated successfully`)
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update user"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={Boolean(user)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage User: {user?.name}</DialogTitle>
          <DialogDescription>
            {user?.email} &bull; ID: <span className="font-mono text-xs">{user?.id}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm">
          <div className="space-y-1.5">
            <Label htmlFor="user-role">Account Role</Label>
            <select
              id="user-role"
              value={role}
              onChange={(e) => setRole(e.target.value as "user" | "admin")}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="user">User (Standard Access)</option>
              <option value="admin">Admin (Full System Control)</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Admins can manage containers, models, workspaces, and all users.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-plan">Subscription Plan</Label>
            <select
              id="user-plan"
              value={plan}
              onChange={(e) => setPlan(e.target.value as "free" | "hacker" | "pro")}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="free">Free Tier</option>
              <option value="hacker">Hacker Tier</option>
              <option value="pro">Pro Tier</option>
            </select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="user-status" className="font-medium">
                Active Account
              </Label>
              <p className="text-xs text-muted-foreground">
                Disabled accounts cannot sign in or run agent tasks
              </p>
            </div>
            <Switch
              id="user-status"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
