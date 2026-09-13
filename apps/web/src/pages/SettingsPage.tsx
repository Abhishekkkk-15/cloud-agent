import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { GitBranchIcon, LinkIcon, UnlinkIcon } from "lucide-react"
import { toast } from "sonner"

import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Spinner } from "@/components/ui/spinner"
import {
  disconnectGitHub,
  getGitHubAuthorizeUrl,
  getGitHubStatus,
} from "@/lib/api"
import { getApiErrorMessage } from "@/lib/http"
import { useAuthStore } from "@/stores/auth-store"
import type { GitHubStatusResponse } from "@cloud-agent/shared"

export function SettingsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const hydrate = useAuthStore((s) => s.hydrate)
  const user = useAuthStore((s) => s.user)
  const [status, setStatus] = useState<GitHubStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const githubResult = searchParams.get("github")
    if (!githubResult) return
    if (githubResult === "connected") {
      toast.success("GitHub connected")
      void hydrate()
    } else if (githubResult === "error") {
      toast.error("GitHub connection failed")
    }
    searchParams.delete("github")
    setSearchParams(searchParams, { replace: true })
  }, [searchParams, setSearchParams, hydrate])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const next = await getGitHubStatus()
        if (!cancelled) setStatus(next)
      } catch (error) {
        if (!cancelled) {
          toast.error(getApiErrorMessage(error, "Could not load GitHub status"))
          setStatus({
            connected: Boolean(user?.githubConnected),
            login: user?.githubLogin ?? null,
            avatarUrl: null,
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user?.githubConnected, user?.githubLogin])

  async function handleConnect() {
    setBusy(true)
    try {
      const url = await getGitHubAuthorizeUrl()
      window.location.href = url
    } catch (error) {
      setBusy(false)
      toast.error(getApiErrorMessage(error, "Could not start GitHub connect"))
    }
  }

  async function handleDisconnect() {
    setBusy(true)
    try {
      const next = await disconnectGitHub()
      setStatus(next)
      await hydrate()
      toast.success("GitHub disconnected")
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not disconnect GitHub"))
    } finally {
      setBusy(false)
    }
  }

  const connected = status?.connected ?? false

  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-medium tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Manage integrations for your Cloud Agent account.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranchIcon className="size-5" />
                GitHub
              </CardTitle>
              <CardDescription>
                Connect GitHub to import public and private repositories into
                workspaces.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner />
                  Loading connection status…
                </div>
              ) : connected ? (
                <div className="flex items-center gap-3">
                  <Avatar>
                    {status?.avatarUrl ? (
                      <AvatarImage
                        src={status.avatarUrl}
                        alt={status.login ?? "GitHub"}
                      />
                    ) : null}
                    <AvatarFallback>
                      {(status?.login ?? "GH").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium">@{status?.login}</p>
                    <p className="text-sm text-muted-foreground">Connected</p>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertTitle>Not connected</AlertTitle>
                  <AlertDescription>
                    Link your GitHub account to browse and import repositories
                    from the dashboard.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              {connected ? (
                <Button
                  variant="outline"
                  onClick={() => void handleDisconnect()}
                  disabled={busy}
                >
                  {busy ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <UnlinkIcon data-icon="inline-start" />
                  )}
                  Disconnect
                </Button>
              ) : (
                <Button onClick={() => void handleConnect()} disabled={busy}>
                  {busy ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <LinkIcon data-icon="inline-start" />
                  )}
                  Connect GitHub
                </Button>
              )}
              <Button variant="ghost" onClick={() => navigate("/dashboard")}>
                Back to dashboard
              </Button>
            </CardFooter>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
