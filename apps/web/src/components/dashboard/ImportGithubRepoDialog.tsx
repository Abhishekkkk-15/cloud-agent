import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { GitBranchIcon, LockIcon, SearchIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  getGitHubAuthorizeUrl,
  importGithubWorkspace,
  listGitHubRepos,
} from "@/lib/api"
import { getApiErrorMessage } from "@/lib/http"
import { useAuthStore } from "@/stores/auth-store"
import { useWorkspaceListStore } from "@/stores/workspace-list-store"
import type { GitHubRepoItem } from "@cloud-agent/shared"

type ImportGithubRepoDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportGithubRepoDialog({
  open,
  onOpenChange,
}: ImportGithubRepoDialogProps) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const fetchWorkspaces = useWorkspaceListStore((s) => s.fetchWorkspaces)
  const [repos, setRepos] = useState<GitHubRepoItem[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [importingId, setImportingId] = useState<number | null>(null)
  const [connecting, setConnecting] = useState(false)

  const connected = Boolean(user?.githubConnected)

  useEffect(() => {
    if (!open) {
      setQuery("")
      setRepos([])
      setImportingId(null)
      setConnecting(false)
      return
    }
    if (!connected) return

    let cancelled = false
    const handle = window.setTimeout(() => {
      void (async () => {
        setLoading(true)
        try {
          const next = await listGitHubRepos(query)
          if (!cancelled) setRepos(next)
        } catch (error) {
          if (!cancelled) {
            toast.error(getApiErrorMessage(error, "Could not load repositories"))
            setRepos([])
          }
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    }, query ? 250 : 0)

    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [open, connected, query])

  async function handleConnect() {
    setConnecting(true)
    try {
      const url = await getGitHubAuthorizeUrl()
      window.location.href = url
    } catch (error) {
      setConnecting(false)
      toast.error(getApiErrorMessage(error, "Could not start GitHub connect"))
    }
  }

  async function handleImport(repo: GitHubRepoItem) {
    if (importingId != null) return
    setImportingId(repo.id)
    try {
      const created = await importGithubWorkspace({
        owner: repo.owner_login,
        name: repo.name,
        full_name: repo.full_name,
        default_branch: repo.default_branch,
        clone_url: repo.clone_url,
        html_url: repo.html_url,
        private: repo.private,
      })
      await fetchWorkspaces()
      toast.success(`Imported ${repo.full_name}`)
      onOpenChange(false)
      navigate(created.redirect_url)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not import repository"))
    } finally {
      setImportingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex w-full flex-col gap-4 overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranchIcon className="size-4 shrink-0" />
            Import from GitHub
          </DialogTitle>
          <DialogDescription>
            Pick a repository to create a linked workspace.
          </DialogDescription>
        </DialogHeader>

        {!connected ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Connect GitHub to list your public and private repositories.
            </p>
            <Button
              className="w-full sm:w-auto sm:self-start"
              onClick={() => void handleConnect()}
              disabled={connecting}
            >
              {connecting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <GitBranchIcon data-icon="inline-start" />
              )}
              Connect GitHub
            </Button>
          </div>
        ) : (
          <div className="flex min-h-0 w-full flex-col gap-3">
            <div className="relative w-full">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search repositories…"
                className="w-full pl-8"
                autoFocus
              />
            </div>

            <div className="w-full overflow-hidden rounded-lg border">
              <div className="max-h-72 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                    <Spinner />
                    Loading repositories…
                  </div>
                ) : repos.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No repositories found.
                  </div>
                ) : (
                  <ul className="w-full">
                    {repos.map((repo) => (
                      <li
                        key={repo.id}
                        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b px-3 py-2.5 last:border-b-0"
                      >
                        <Avatar size="sm" className="size-8 shrink-0 rounded-md after:rounded-md">
                          {repo.owner_avatar_url ? (
                            <AvatarImage
                              src={repo.owner_avatar_url}
                              alt={repo.owner_login}
                              className="rounded-md"
                            />
                          ) : null}
                          <AvatarFallback className="rounded-md text-xs">
                            {repo.owner_login.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {repo.full_name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {repo.private ? "Private" : "Public"}
                            {" · "}
                            {repo.default_branch}
                            {repo.description
                              ? ` · ${repo.description}`
                              : null}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {repo.private ? (
                            <LockIcon
                              className="size-3.5 text-muted-foreground"
                              aria-label="Private"
                            />
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={importingId != null}
                            onClick={() => void handleImport(repo)}
                          >
                            {importingId === repo.id ? (
                              <Spinner data-icon="inline-start" />
                            ) : null}
                            Import
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
