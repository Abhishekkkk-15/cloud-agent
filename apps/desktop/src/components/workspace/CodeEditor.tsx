import { useEffect } from "react"
import { FileCodeIcon, LockIcon, SaveIcon, XIcon } from "lucide-react"

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
import type { FileNode } from "@cloud-agent/shared"
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
  const saveActiveFile = useWorkspaceStore((s) => s.saveActiveFile)
  const filesDirty = useWorkspaceStore((s) => s.filesDirty)
  const chatLoading = useWorkspaceStore((s) => s.chatLoading)
  const streamingMessageId = useWorkspaceStore((s) => s.streamingMessageId)

  const isAgentBusy = chatLoading || Boolean(streamingMessageId)

  const flat = flattenFiles(files)
  const openFiles = openFileIds
    .map((id) => flat.find((f) => f.id === id))
    .filter(Boolean) as FileNode[]
  const active = flat.find((f) => f.id === activeFileId) ?? null
  const isDirty = active ? Boolean(filesDirty[active.id]) : false

  // Global Ctrl+S / Cmd+S save listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        if (active && !isAgentBusy) {
          void saveActiveFile()
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [active, isAgentBusy, saveActiveFile])

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
              Select a file from the explorer to view and edit.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Tab bar & Actions */}
      <div className="flex h-10 items-center justify-between border-b bg-muted/20 px-1">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {openFiles.map((file) => {
            const isActive = file.id === activeFileId
            const dirty = Boolean(filesDirty[file.id])

            return (
              <div
                key={file.id}
                className={cn(
                  "group flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors cursor-pointer select-none",
                  isActive
                    ? "border-border bg-background text-foreground shadow-2xs"
                    : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
                onClick={() => setActiveFile(file.id)}
              >
                <span className="max-w-44 truncate">{file.name}</span>

                {dirty && (
                  <span
                    className="size-1.5 rounded-full bg-primary"
                    title="Unsaved changes"
                  />
                )}

                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-5 rounded-xs p-0 text-muted-foreground/70 hover:bg-muted hover:text-foreground opacity-60 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeFile(file.id)
                  }}
                  aria-label={`Close ${file.name}`}
                >
                  <XIcon className="size-3" />
                </Button>
              </div>
            )
          })}
        </div>

        {/* Right action controls */}
        <div className="flex items-center gap-1.5 shrink-0 px-1">
          {isDirty && (
            <Button
              variant="outline"
              size="xs"
              className="h-7 gap-1 px-2 text-[11px] font-medium"
              disabled={isAgentBusy}
              onClick={() => void saveActiveFile()}
              title="Save changes (Ctrl+S)"
            >
              <SaveIcon className="size-3" />
              Save
            </Button>
          )}
        </div>
      </div>

      {/* Agent Conflict Warning Banner */}
      {isAgentBusy && (
        <div className="flex items-center gap-2 border-b bg-amber-500/10 px-3 py-1 text-xs text-amber-700 dark:text-amber-400">
          <LockIcon className="size-3.5 shrink-0" />
          <span>
            Agent is running — editor is locked in read-only mode to prevent file conflicts.
          </span>
        </div>
      )}

      {/* Breadcrumb Path Bar */}
      <div className="flex h-7 items-center justify-between border-b bg-muted/10 px-3 text-[11px] text-muted-foreground font-mono">
        <span className="truncate">{active.path}</span>
        {active.language && (
          <span className="capitalize text-muted-foreground/70">{active.language}</span>
        )}
      </div>

      {/* Monaco Code Editor */}
      <div className="min-h-0 flex-1">
        <MonacoEditor
          fileId={active.id}
          fileName={active.name}
          language={active.language}
          value={active.content ?? ""}
          readOnly={isAgentBusy}
          onChange={(value, fileId) => {
            if (useWorkspaceStore.getState().activeFileId !== fileId) return
            updateActiveContent(value)
          }}
        />
      </div>
    </div>
  )
}
