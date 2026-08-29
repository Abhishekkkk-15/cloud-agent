import { useEffect, useState } from "react"
import { Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type ManageSidebarItemTarget =
  | {
      kind: "workspace"
      workspaceId: string
      title: string
    }
  | {
      kind: "session"
      workspaceId: string
      sessionId: string
      title: string
    }

type ManageSidebarItemDialogProps = {
  target: ManageSidebarItemTarget | null
  onOpenChange: (open: boolean) => void
  busy?: boolean
  onSave: (name: string) => Promise<void>
  onDelete: () => Promise<void>
  onOpen?: () => void
}

export function ManageSidebarItemDialog({
  target,
  onOpenChange,
  busy = false,
  onSave,
  onDelete,
  onOpen,
}: ManageSidebarItemDialogProps) {
  const [name, setName] = useState(target?.title ?? "")

  useEffect(() => {
    setName(target?.title ?? "")
  }, [target])

  if (!target) return null

  const isWorkspace = target.kind === "workspace"
  const initialName = target.title

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (trimmed === initialName.trim()) {
      onOpenChange(false)
      return
    }
    await onSave(trimmed)
    onOpenChange(false)
  }

  async function handleDelete() {
    await onDelete()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!busy) onOpenChange(open)
      }}
    >
      <DialogContent showCloseButton={!busy}>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>
              {isWorkspace ? "Manage workspace" : "Manage session"}
            </DialogTitle>
            <DialogDescription>
              {isWorkspace
                ? "Rename this workspace or remove it from your list."
                : "Rename this session, open it, or remove it."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="manage-item-name">Name</Label>
            <Input
              id="manage-item-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              disabled={busy}
              className="mt-2"
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy}
              className="w-full sm:w-auto"
              onClick={() => void handleDelete()}
            >
              <Trash2Icon className="size-4" />
              Delete
            </Button>
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
              {!isWorkspace && onOpen ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    onOpen()
                    onOpenChange(false)
                  }}
                >
                  Open
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
