import { Navigate, useLocation } from "react-router-dom"

import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton"
import { AppHeader } from "@/components/layout/AppHeader"
import { useAuthStore } from "@/stores/auth-store"

export function LoginPage() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const location = useLocation()
  const from =
    (location.state as { from?: string } | null)?.from ?? "/dashboard"

  if (!loading && user) {
    return <Navigate to={from} replace />
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-medium tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Continue with Google to open your Cloud Agent workspace.
          </p>
        </div>
        <GoogleSignInButton redirectTo={from} />
      </main>
    </div>
  )
}
