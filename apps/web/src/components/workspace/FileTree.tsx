import { useState } from "react"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useWorkspaceStore } from "@/stores/workspace-store"
import type { FileNode } from "@cloud-agent/shared"
import { cn } from "@/lib/utils"

function TreeNode({
  node,
  depth = 0,
}: {
  node: FileNode
  depth?: number
}) {
  const openFile = useWorkspaceStore((s) => s.openFile)
  const activeFileId = useWorkspaceStore((s) => s.activeFileId)
  const [expanded, setExpanded] = useState(true)
  const isActive = activeFileId === node.id

  if (node.type === "folder") {
    return (
      <div>
        <button
          type="button"
          className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{node.name}</span>
        </button>
        {expanded &&
          node.children?.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
      </div>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm hover:bg-muted",
        isActive && "bg-muted font-medium"
      )}
      style={{ paddingLeft: 8 + depth * 12 + 16 }}
      onClick={() => openFile(node.id)}
    >
      <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{node.name}</span>
    </button>
  )
}

export function FileTree() {
  const files = useWorkspaceStore((s) => s.files)
  const project = useWorkspaceStore((s) => s.project)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 items-center justify-between border-b px-3">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Files
        </span>
        <Button variant="ghost" size="xs" disabled>
          {project?.name ?? "Project"}
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2">
          {files.map((node) => (
            <TreeNode key={node.id} node={node} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
