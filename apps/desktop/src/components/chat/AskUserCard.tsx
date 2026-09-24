import { useState } from "react"
import { CheckIcon, PlayIcon, ShieldAlertIcon, TerminalIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import type { AskUserPrompt } from "@/types/agent"

export function AskUserCard({
  prompt,
  onApprove,
  onReject,
}: {
  prompt: AskUserPrompt
  onApprove: () => void
  onReject: (reason?: string) => void
}) {
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [approving, setApproving] = useState(false)

  const isPending = prompt.status === "pending"
  const isApproved = prompt.status === "approved"
  const isRejected = prompt.status === "rejected"

  const handleApprove = async () => {
    setApproving(true)
    try {
      await onApprove()
    } finally {
      setApproving(false)
    }
  }

  const handleConfirmReject = () => {
    onReject(rejectReason || "Rejected by user")
    setRejecting(false)
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-sm dark:bg-amber-500/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ShieldAlertIcon className="size-4" />
          </span>
          <div>
            <h4 className="text-xs font-semibold text-foreground">{prompt.title}</h4>
            <p className="text-[11px] text-muted-foreground">{prompt.description}</p>
          </div>
        </div>

        <Badge
          variant={isPending ? "outline" : isApproved ? "secondary" : "destructive"}
          className="text-[10px] font-normal"
        >
          {isPending ? "Pending Action" : isApproved ? "Approved" : "Rejected"}
        </Badge>
      </div>

      {/* Code / Command Preview box */}
      {prompt.command && (
        <div className="my-3 rounded-lg border bg-background/80 p-2.5 font-mono text-xs shadow-inner">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pb-1 border-b mb-1.5">
            <TerminalIcon className="size-3" />
            <span>Terminal Command to Execute</span>
          </div>
          <span className="text-primary font-medium select-all">${prompt.command}</span>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="mt-3 flex flex-col gap-2">
          {rejecting ? (
            <div className="flex items-center gap-2">
              <Input
                placeholder="Reason for rejection (optional)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="h-8 text-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmReject()
                  if (e.key === "Escape") setRejecting(false)
                }}
              />
              <Button size="sm" variant="destructive" className="h-8 text-xs shrink-0" onClick={handleConfirmReject}>
                Confirm Reject
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs shrink-0" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
                onClick={() => setRejecting(true)}
              >
                <XIcon className="size-3.5" />
                <span>Reject</span>
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-medium"
                onClick={handleApprove}
                disabled={approving}
              >
                {approving ? (
                  <span>Executing...</span>
                ) : (
                  <>
                    <PlayIcon className="size-3.5 fill-current" />
                    <span>Approve & Execute</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Outcome Banner */}
      {!isPending && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium">
          {isApproved && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckIcon className="size-3.5" /> Approved and executed on host machine
            </span>
          )}
          {isRejected && (
            <span className="flex items-center gap-1 text-rose-500">
              <XIcon className="size-3.5" /> Execution blocked by user ({prompt.response || "No reason given"})
            </span>
          )}
        </div>
      )}
    </div>
  )
}
