import { useState, useRef, useEffect } from "react"
import { Toaster } from "sonner"
import type { PanelImperativeHandle } from "react-resizable-panels"

import { WorkspaceToolbar } from "@/components/workspace/WorkspaceToolbar"
import { DesktopSidebar } from "@/components/sidebar/DesktopSidebar"
import { AiChatPanel } from "@/components/workspace/AiChatPanel"
import { FileTree } from "@/components/workspace/FileTree"
import { CodeEditor } from "@/components/workspace/CodeEditor"
import { TerminalPanel } from "@/components/workspace/TerminalPanel"
import { PairDeviceDialog } from "@/components/modals/PairDeviceDialog"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { cn } from "@/lib/utils"

export function App() {
  const [pairModalOpen, setPairModalOpen] = useState(false)
  const workspaceTab = useWorkspaceStore((s) => s.workspaceTab)
  const chatCollapsed = useWorkspaceStore((s) => s.chatCollapsed)
  const setChatCollapsed = useWorkspaceStore((s) => s.setChatCollapsed)
  const chatPanelRef = useRef<PanelImperativeHandle | null>(null)

  useEffect(() => {
    const panel = chatPanelRef.current
    if (!panel) return
    if (chatCollapsed && !panel.isCollapsed()) {
      panel.collapse()
    } else if (!chatCollapsed && panel.isCollapsed()) {
      panel.expand()
    }
  }, [chatCollapsed])

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground antialiased select-none font-sans">
      {/* 1. Desktop Window Header / Workspace Toolbar with Agent Selector & Window Controls */}
      <WorkspaceToolbar onOpenPairModal={() => setPairModalOpen(true)} />

      {/* 2. Main Work Area: Left Multi-Workspace Sessions Sidebar + Resizable Work Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Collapsible Left Multi-Workspace & Sessions Sidebar */}
        <DesktopSidebar onOpenPairModal={() => setPairModalOpen(true)} />

        {/* Resizable Main Panels: Chat Panel + Code/Console Tabs (NO PREVIEW) */}
        <main className="flex flex-1 min-w-0 flex-col overflow-hidden">
          <ResizablePanelGroup
            id="desktop-main-split"
            orientation="horizontal"
            className="h-full"
          >
            {/* Left Resizable Panel: Full AI Chat Panel */}
            <ResizablePanel
              id="desktop-chat"
              panelRef={chatPanelRef}
              collapsible
              collapsedSize={0}
              defaultSize="45%"
              minSize="25%"
              maxSize="70%"
              onResize={(size) => {
                const isCollapsed = size.asPercentage === 0
                if (isCollapsed !== chatCollapsed) {
                  setChatCollapsed(isCollapsed)
                }
              }}
              className="min-h-0 overflow-hidden"
            >
              <AiChatPanel />
            </ResizablePanel>

            <ResizableHandle
              withHandle={!chatCollapsed}
              className={cn(
                "transition-colors",
                chatCollapsed && "hover:bg-primary/50 cursor-col-resize after:w-3"
              )}
            />

            {/* Right Resizable Panel: Code / Console Panel (NO Preview) */}
            <ResizablePanel
              id="desktop-workspace"
              defaultSize="55%"
              minSize="30%"
              className="min-h-0 overflow-hidden"
            >
              {workspaceTab === "code" ? (
                <ResizablePanelGroup
                  id="desktop-code-split"
                  orientation="horizontal"
                  className="h-full"
                >
                  {/* File Explorer Tree */}
                  <ResizablePanel
                    id="desktop-files"
                    defaultSize="24%"
                    minSize="16%"
                    maxSize="40%"
                    className="min-h-0 border-r"
                  >
                    <FileTree />
                  </ResizablePanel>

                  <ResizableHandle withHandle />

                  {/* Monaco Code Editor */}
                  <ResizablePanel
                    id="desktop-editor"
                    defaultSize="76%"
                    minSize="40%"
                    className="min-h-0"
                  >
                    <CodeEditor />
                  </ResizablePanel>
                </ResizablePanelGroup>
              ) : (
                /* Interactive Terminal Panel */
                <TerminalPanel />
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </main>
      </div>

      {/* 3. Mobile / Web Device Pairing Modal */}
      <PairDeviceDialog open={pairModalOpen} onOpenChange={setPairModalOpen} />

      {/* 4. Global Toast Notifications */}
      <Toaster position="bottom-right" richColors />
    </div>
  )
}

export default App
