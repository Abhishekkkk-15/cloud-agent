import { useState } from "react"
import { Toaster } from "sonner"
import { DesktopTitlebar } from "@/components/layout/DesktopTitlebar"
import { DesktopSidebar } from "@/components/sidebar/DesktopSidebar"
import { AiChatPanel } from "@/components/chat/AiChatPanel"
import { PairDeviceDialog } from "@/components/modals/PairDeviceDialog"

export function App() {
  const [pairModalOpen, setPairModalOpen] = useState(false)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground antialiased select-none font-sans">
      {/* 1. Desktop Window Header / Titlebar */}
      <DesktopTitlebar onOpenPairModal={() => setPairModalOpen(true)} />

      {/* 2. Main Window Work Area: Left Sidebar + Full Screen Chat Panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Collapsible Left Sidebar */}
        <DesktopSidebar onOpenPairModal={() => setPairModalOpen(true)} />

        {/* Full-Screen Chat Panel (No preview panel) */}
        <main className="flex flex-1 min-w-0 flex-col overflow-hidden">
          <AiChatPanel />
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
