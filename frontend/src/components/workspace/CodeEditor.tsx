import { FileCodeIcon, XIcon } from "lucide-react"

import { MonacoEditor } from "@/components/workspace/MonacoEditor"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useWorkspaceStore } from "@/stores/workspace-store"
import type { FileNode } from "@/types/schemas"
import { cn } from "@/lib/utils"

function flattenFiles(nodes: FileNode[], acc: FileNode[] = []): FileNode[] {
  for (const node of nodes) {
    if (node.type === "file") acc.push(node)
    if (node.children) flattenFiles(node.children, acc)
  }
  return acc
}

export function CodeEditor() {
  const files = useWorkspaceStore((s) => s.files)
  const openFileIds = useWorkspaceStore((s) => s.openFileIds)
  const activeFileId = useWorkspaceStore((s) => s.activeFileId)
  const setActiveFile = useWorkspaceStore((s) => s.setActiveFile)
  const closeFile = useWorkspaceStore((s) => s.closeFile)
  const updateActiveContent = useWorkspaceStore((s) => s.updateActiveContent)

  const flat = flattenFiles(files)
  const openFiles = openFileIds
    .map((id) => flat.find((f) => f.id === id))
    .filter(Boolean) as FileNode[]
  const active = flat.find((f) => f.id === activeFileId) ?? null

  if (!active) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileCodeIcon />
            </EmptyMedia>
            <EmptyTitle>No file open</EmptyTitle>
            <EmptyDescription>
              Select a file from the explorer to start editing.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 items-center gap-1 overflow-x-auto border-b px-1">
        {openFiles.map((file) => (
          <div
            key={file.id}
            className={cn(
              "group flex h-8 shrink-0 items-center gap-1 rounded-md border border-transparent px-2 text-sm",
              file.id === activeFileId ? "bg-muted" : "hover:bg-muted/60"
            )}
          >
            <button
              type="button"
              className="max-w-40 truncate"
              onClick={() => setActiveFile(file.id)}
            >
              {file.name}
            </button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="opacity-0 group-hover:opacity-100"
              onClick={() => closeFile(file.id)}
              aria-label={`Close ${file.name}`}
            >
              <XIcon />
            </Button>
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        <MonacoEditor
          fileId={active.id}
          fileName={active.name}
          language={active.language}
          value={active.content ?? ""}
          onChange={(value, fileId) => {
            if (useWorkspaceStore.getState().activeFileId !== fileId) return
            updateActiveContent(value)
          }}
        />
      </div>
    </div>
  )
}
