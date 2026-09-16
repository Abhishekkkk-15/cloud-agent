import { useEffect, useRef, useState } from "react"
import { CheckIcon, CopyIcon, RefreshCwIcon } from "lucide-react"
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
import { Spinner } from "@/components/ui/spinner"
import { getAdminContainerLogs } from "@/lib/api"
import { getApiErrorMessage } from "@/lib/http"
import type { AdminContainer } from "@cloud-agent/shared"

type Props = {
  container: AdminContainer | null
  onClose: () => void
}

export function ContainerLogsDialog({ container, onClose }: Props) {
  const [logs, setLogs] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tail, setTail] = useState(150)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function fetchLogs(isSilent = false) {
    if (!container) return
    if (!isSilent) setLoading(true)
    try {
      const res = await getAdminContainerLogs(container.id, tail)
      setLogs(res.logs || "No logs output yet.")
    } catch (err) {
      if (!isSilent) {
        toast.error(getApiErrorMessage(err, "Failed to fetch container logs"))
      }
    } finally {
      if (!isSilent) setLoading(false)
    }
  }

  useEffect(() => {
    if (container) {
      void fetchLogs()
    } else {
      setLogs("")
    }
  }, [container, tail])

  useEffect(() => {
    if (!autoRefresh || !container) return
    const interval = setInterval(() => {
      void fetchLogs(true)
    }, 3000)
    return () => clearInterval(interval)
  }, [autoRefresh, container, tail])

  function handleCopy() {
    navigator.clipboard.writeText(logs)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success("Logs copied to clipboard")
  }

  return (
    <Dialog open={Boolean(container)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <span>Container Logs</span>
                <span className="font-mono text-xs text-muted-foreground">
                  ({container?.short_id})
                </span>
              </DialogTitle>
              <DialogDescription>
                {container?.name} &bull; Image: {container?.image}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={tail}
                onChange={(e) => setTail(Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value={50}>Last 50 lines</option>
                <option value={150}>Last 150 lines</option>
                <option value={300}>Last 300 lines</option>
                <option value={500}>Last 500 lines</option>
              </select>
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <RefreshCwIcon
                  className={`size-3 ${autoRefresh ? "animate-spin" : ""}`}
                />
                {autoRefresh ? "Live" : "Auto-refresh"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="relative mt-2 max-h-[60vh] min-h-[300px] overflow-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs text-zinc-200 dark:bg-black">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-all leading-relaxed">
              {logs}
            </pre>
          )}
          <div ref={bottomRef} />
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div className="text-xs text-muted-foreground">
            Status: <span className="font-medium text-foreground">{container?.status}</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={loading || !logs}
            >
              {copied ? (
                <CheckIcon className="size-3.5 text-emerald-500" />
              ) : (
                <CopyIcon className="size-3.5" />
              )}
              {copied ? "Copied" : "Copy Logs"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void fetchLogs()}>
              <RefreshCwIcon className="size-3.5" />
              Refresh
            </Button>
            <Button variant="default" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
