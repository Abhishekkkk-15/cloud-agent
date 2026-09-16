import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AdminContainer } from "@cloud-agent/shared"

type Props = {
  container: AdminContainer | null
  onClose: () => void
}

export function ContainerInspectDialog({ container, onClose }: Props) {
  if (!container) return null

  return (
    <Dialog open={Boolean(container)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Inspect Container: {container.name}</DialogTitle>
          <DialogDescription>
            ID: <span className="font-mono">{container.id}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
            <div>
              <span className="text-muted-foreground">Image:</span>{" "}
              <span className="font-mono font-medium">{container.image}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>{" "}
              <span className="font-medium capitalize">{container.status}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>{" "}
              <span>{container.created ? new Date(container.created).toLocaleString() : "N/A"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Workspace ID:</span>{" "}
              <span className="font-mono">{container.workspace_id || "Unassigned"}</span>
            </div>
          </div>

          <div>
            <h4 className="mb-1 font-semibold text-foreground">Port Mappings</h4>
            {Object.keys(container.ports).length > 0 ? (
              <div className="rounded-lg border p-2">
                {Object.entries(container.ports).map(([containerPort, hostPort]) => (
                  <div key={containerPort} className="flex justify-between py-0.5 font-mono">
                    <span className="text-muted-foreground">{containerPort}</span>
                    <span>&rarr; {String(hostPort)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border p-2 text-muted-foreground">No ports published</div>
            )}
          </div>

          <div>
            <h4 className="mb-1 font-semibold text-foreground">Raw Container Attributes</h4>
            <div className="max-h-60 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-zinc-200 dark:bg-black">
              <pre className="whitespace-pre-wrap">{JSON.stringify(container, null, 2)}</pre>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="default" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
