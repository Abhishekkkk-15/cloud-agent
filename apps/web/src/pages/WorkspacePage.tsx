import { useEffect, useRef } from "react"
import { useParams, useSearchParams } from "react-router-dom"

import { AiChatPanel } from "@/components/workspace/AiChatPanel"
import { CodeEditor } from "@/components/workspace/CodeEditor"
import { FileTree } from "@/components/workspace/FileTree"
import { PreviewPanel } from "@/components/workspace/PreviewPanel"
import { TerminalPanel } from "@/components/workspace/TerminalPanel"
import { WorkspaceToolbar } from "@/components/workspace/WorkspaceToolbar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useWorkspaceStore } from "@/stores/workspace-store"
import { ws } from "@/lib/websocket"
export function WorkspacePage() {
  const { workspaceId = "" } = useParams()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get("session")
  const loadWorkspace = useWorkspaceStore((s) => s.loadWorkspace)
  const loading = useWorkspaceStore((s) => s.loading)
  const error = useWorkspaceStore((s) => s.error)
  const workspaceTab = useWorkspaceStore((s) => s.workspaceTab)
  const setWorkspaceTab = useWorkspaceStore((s) => s.setWorkspaceTab)

  useEffect(() => {
    ;(async () => {
      await ws.connect()
      console.log("run afterwards")
      ws.send("agent:start", {
        workspace_id: workspaceId,
        session_id: sessionId,
      })
    })()

    const unsubscribe = ws.subscribe("agent:send", (event) => {
      console.log(event)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (workspaceId) {
      loadWorkspace(workspaceId, sessionId)
    }
  }, [workspaceId, sessionId, loadWorkspace])

  if (loading) {
    return (
      <div className="flex h-svh flex-col gap-2 p-3">
        <Skeleton className="h-12 w-full" />
        <div className="grid min-h-0 flex-1 grid-cols-[2fr_3fr] gap-2">
          <Skeleton className="h-full" />
          <Skeleton className="h-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-svh items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Workspace failed to load</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <WorkspaceToolbar />
      <div className="min-h-0 flex-1">
        <ResizablePanelGroup
          id="workspace-main"
          orientation="horizontal"
          className="h-full"
        >
          <ResizablePanel
            id="agent"
            defaultSize="40%"
            minSize="28%"
            maxSize="55%"
            className="min-h-0"
          >
            <AiChatPanel />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel
            id="workspace"
            defaultSize="60%"
            minSize="40%"
            className="min-h-0"
          >
            <Tabs
              value={workspaceTab}
              onValueChange={(value) => {
                if (
                  value === "preview" ||
                  value === "code" ||
                  value === "console"
                ) {
                  setWorkspaceTab(value)
                }
              }}
              className="flex h-full min-h-0 flex-col gap-0"
            >
              <div className="flex h-10 shrink-0 items-center border-b px-2">
                <TabsList variant="line">
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="code">Code</TabsTrigger>
                  <TabsTrigger value="console">Console</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent
                value="preview"
                className="mt-0 min-h-0 flex-1 outline-none"
              >
                <PreviewPanel />
              </TabsContent>

              <TabsContent
                value="code"
                className="mt-0 min-h-0 flex-1 outline-none"
              >
                <ResizablePanelGroup
                  id="code-split"
                  orientation="horizontal"
                  className="h-full"
                >
                  <ResizablePanel
                    id="files"
                    defaultSize="24%"
                    minSize="16%"
                    maxSize="40%"
                    className="min-h-0 border-r"
                  >
                    <FileTree />
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel
                    id="editor"
                    defaultSize="76%"
                    minSize="40%"
                    className="min-h-0"
                  >
                    <CodeEditor />
                  </ResizablePanel>
                </ResizablePanelGroup>
              </TabsContent>

              <TabsContent
                value="console"
                className="mt-0 min-h-0 flex-1 outline-none"
              >
                <TerminalPanel />
              </TabsContent>
            </Tabs>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
