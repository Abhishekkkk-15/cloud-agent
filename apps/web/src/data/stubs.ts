import type { FileNode, TerminalLine } from "@cloud-agent/shared"

/** Placeholder file tree until sandbox file APIs are wired. */
export const defaultFileTree: FileNode[] = [
  {
    id: "readme",
    name: "README.md",
    type: "file",
    language: "markdown",
    content: "# Workspace\n\nNo files loaded yet.\n",
  },
]

export const defaultTerminalBoot: TerminalLine[] = []
