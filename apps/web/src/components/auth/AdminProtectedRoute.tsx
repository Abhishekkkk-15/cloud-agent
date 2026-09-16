import { Link, Navigate, useLocation } from "react-router-dom"
import { ShieldAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useAuthStore } from "@/stores/auth-store"

export function AdminProtectedRoute({
  children,
}: {
  children: React.ReactNode
}) {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (user.role !== "admin") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlertIcon className="size-7" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Access Required</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Your account ({user.email}) does not have administrative privileges to access
          the Cloud Agent Admin Dashboard. Contact the system administrator for access.
        </p>
        <div className="mt-2 flex gap-3">
          <Button render={<Link to="/dashboard" />}>Return to Dashboard</Button>
        </div>
      </div>
    )
  }

  return children
}
