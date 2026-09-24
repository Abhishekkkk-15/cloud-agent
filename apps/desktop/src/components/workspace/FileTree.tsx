import { useState } from "react"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DownloadIcon,
  FileCodeIcon,
  FileIcon,
  FileJsonIcon,
  FilePlusIcon,
  FileTextIcon,
  FolderIcon,
  FolderMinusIcon,
  FolderPlusIcon,
  MoreVerticalIcon,
  PencilIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { downloadWorkspaceZip } from "@/lib/api"
import { getApiErrorMessage } from "@/lib/http"
import { useWorkspaceStore } from "@/stores/workspace-store"
import type { FileNode } from "@cloud-agent/shared"
import { cn } from "@/lib/utils"

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  if (["tsx", "jsx"].includes(ext)) {
    return <FileCodeIcon className="size-3.5 shrink-0 text-sky-500" />
  }
  if (["ts", "js", "mjs", "cjs"].includes(ext)) {
    return <FileCodeIcon className="size-3.5 shrink-0 text-blue-500" />
  }
  if (["css", "scss", "less"].includes(ext)) {
    return <FileCodeIcon className="size-3.5 shrink-0 text-pink-500" />
  }
  if (["json"].includes(ext)) {
    return <FileJsonIcon className="size-3.5 shrink-0 text-amber-500" />
  }
  if (["md", "markdown", "txt"].includes(ext)) {
    return <FileTextIcon className="size-3.5 shrink-0 text-emerald-500" />
  }
  if (["py"].includes(ext)) {
    return <FileCodeIcon className="size-3.5 shrink-0 text-yellow-500" />
  }
  if (["html", "htm"].includes(ext)) {
    return <FileCodeIcon className="size-3.5 shrink-0 text-orange-500" />
  }
  return <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
}

function TreeNode({
  node,
  depth = 0,
  collapseAll,
}: {
  node: FileNode
  depth?: number
  collapseAll: boolean
}) {
  const openFile = useWorkspaceStore((s) => s.openFile)
  const activeFileId = useWorkspaceStore((s) => s.activeFileId)
  const deleteFile = useWorkspaceStore((s) => s.deleteFile)
  const renameFile = useWorkspaceStore((s) => s.renameFile)
  const [expanded, setExpanded] = useState(!collapseAll)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(node.name)

  const nodePath = node.path || node.id
  const isActive = activeFileId === node.id

  const handleRenameSubmit = async () => {
    if (!renameValue.trim() || renameValue === node.name) {
      setIsRenaming(false)
      return
    }
    const parts = nodePath.split("/")
    parts[parts.length - 1] = renameValue.trim()
    const newPath = parts.join("/")
    try {
      await renameFile(nodePath, newPath)
    } finally {
      setIsRenaming(false)
    }
  }

  if (node.type === "folder") {
    return (
      <div className="select-none">
        <div
          className="group flex w-full items-center justify-between rounded-md py-1 pr-1.5 text-left text-xs font-medium text-foreground/80 hover:bg-muted/60"
          style={{ paddingLeft: 6 + depth * 12 }}
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left cursor-pointer"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground" />
            )}
            <FolderIcon className="size-3.5 shrink-0 text-sky-500/80" />
            <span className="truncate">{node.name}</span>
          </button>

          {/* Folder actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-5 rounded-xs p-0 text-muted-foreground opacity-0 group-hover:opacity-100"
                />
              }
            >
              <MoreVerticalIcon className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32">
              <DropdownMenuItem
                variant="destructive"
                onClick={() => void deleteFile(nodePath)}
              >
                <Trash2Icon className="size-3.5 mr-1" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {expanded &&
          node.children?.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              collapseAll={collapseAll}
            />
          ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "group flex w-full items-center justify-between rounded-md py-1 pr-1.5 text-left text-xs transition-colors cursor-pointer select-none",
        isActive
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
      style={{ paddingLeft: 6 + depth * 12 + 14 }}
      onClick={() => {
        if (!isRenaming) openFile(node.id)
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {getFileIcon(node.name)}
        {isRenaming ? (
          <Input
            value={renameValue}
            autoFocus
            className="h-5 text-xs px-1 py-0 w-32"
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleRenameSubmit()
              if (e.key === "Escape") setIsRenaming(false)
            }}
            onBlur={() => void handleRenameSubmit()}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate">{node.name}</span>
        )}
      </div>

      {/* File context menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-5 rounded-xs p-0 text-muted-foreground opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            />
          }
        >
          <MoreVerticalIcon className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-32">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              setIsRenaming(true)
            }}
          >
            <PencilIcon className="size-3.5 mr-1" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation()
              void deleteFile(nodePath)
            }}
          >
            <Trash2Icon className="size-3.5 mr-1" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function FileTree() {
  const workspace = useWorkspaceStore((s) => s.workspace)
  const files = useWorkspaceStore((s) => s.files)
  const fetchFiles = useWorkspaceStore((s) => s.fetchFiles)
  const createFile = useWorkspaceStore((s) => s.createFile)
  const filesLoading = useWorkspaceStore((s) => s.filesLoading)

  const [collapseAll, setCollapseAll] = useState(false)
  const [isCreating, setIsCreating] = useState<"file" | "folder" | null>(null)
  const [newItemName, setNewItemName] = useState("")
  const [downloading, setDownloading] = useState(false)

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemName.trim() || !isCreating) {
      setIsCreating(null)
      return
    }
    try {
      await createFile(newItemName.trim(), isCreating)
      setNewItemName("")
      setIsCreating(null)
    } catch {
      // Error handled by store
    }
  }

  const handleDownload = async () => {
    if (!workspace?.id || downloading) return
    setDownloading(true)
    try {
      await downloadWorkspaceZip(workspace.id, workspace.title)
      toast.success("Download started", {
        description: "Your project ZIP is downloading.",
      })
    } catch (err) {
      toast.error("Download failed", {
        description: getApiErrorMessage(err, "Failed to download project zip"),
      })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Explorer Header */}
      <div className="flex h-10 items-center justify-between border-b px-3">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Explorer
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-6 rounded-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setIsCreating("file")
              setNewItemName("")
            }}
            title="New File"
          >
            <FilePlusIcon className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            className="size-6 rounded-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setIsCreating("folder")
              setNewItemName("")
            }}
            title="New Folder"
          >
            <FolderPlusIcon className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            className="size-6 rounded-xs text-muted-foreground hover:text-foreground"
            onClick={() => setCollapseAll((v) => !v)}
            title="Toggle Folders"
          >
            <FolderMinusIcon className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            className={cn(
              "size-6 rounded-xs text-muted-foreground hover:text-foreground",
              filesLoading && "animate-spin text-primary"
            )}
            onClick={() => void fetchFiles()}
            title="Refresh Files"
          >
            <RefreshCwIcon className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-xs"
            className="size-6 rounded-xs text-muted-foreground hover:text-foreground"
            onClick={() => void handleDownload()}
            disabled={downloading}
            title="Download workspace as ZIP"
          >
            {downloading ? (
              <RefreshCwIcon className="size-3.5 animate-spin text-primary" />
            ) : (
              <DownloadIcon className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Inline item creation form */}
      {isCreating && (
        <form
          onSubmit={handleCreateSubmit}
          className="flex items-center gap-1.5 border-b bg-muted/30 px-3 py-1.5"
        >
          {isCreating === "file" ? (
            <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <FolderIcon className="size-3.5 shrink-0 text-sky-500" />
          )}
          <Input
            autoFocus
            value={newItemName}
            placeholder={
              isCreating === "file" ? "e.g. src/utils/math.ts" : "e.g. src/components"
            }
            className="h-6 text-xs px-1.5 py-0"
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setIsCreating(null)
            }}
          />
        </form>
      )}

      {/* File List Tree */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-1.5 space-y-0.5">
          {files.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {filesLoading ? "Loading files…" : "No files found"}
            </div>
          ) : (
            files.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                collapseAll={collapseAll}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
