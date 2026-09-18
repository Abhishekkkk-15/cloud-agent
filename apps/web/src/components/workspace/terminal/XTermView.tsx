import { useEffect, useRef, useState, useCallback } from "react"
import { Terminal } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import { WebLinksAddon } from "@xterm/addon-web-links"
import "@xterm/xterm/css/xterm.css"
import { useTheme } from "@/components/theme-provider"
import { getTerminalWsUrl } from "./terminal-url"
import { Loader2Icon, RefreshCwIcon, TerminalIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface XTermViewProps {
  workspaceId: string
  onStatusChange?: (status: "connecting" | "connected" | "disconnected" | "error") => void
  onRegisterActions?: (actions: { clear: () => void; reconnect: () => void }) => void
}

export function XTermView({
  workspaceId,
  onStatusChange,
  onRegisterActions,
}: XTermViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("connecting")

  const { colorMode } = useTheme()

  const updateStatus = useCallback(
    (status: "connecting" | "connected" | "disconnected" | "error") => {
      setConnectionStatus(status)
      onStatusChange?.(status)
    },
    [onStatusChange]
  )

  const clearTerminal = useCallback(() => {
    termRef.current?.clear()
  }, [])

  const connect = useCallback(() => {
    if (!workspaceId) return

    updateStatus("connecting")

    if (wsRef.current) {
      try {
        wsRef.current.close()
      } catch {
        // ignore
      }
      wsRef.current = null
    }

    const url = getTerminalWsUrl(workspaceId)
    const ws = new WebSocket(url)
    ws.binaryType = "arraybuffer"
    wsRef.current = ws

    ws.onopen = () => {
      updateStatus("connected")
      const term = termRef.current
      const fit = fitAddonRef.current
      if (term && fit) {
        fit.fit()
        // Notify backend of current terminal geometry
        ws.send(
          JSON.stringify({
            type: "resize",
            cols: term.cols,
            rows: term.rows,
          })
        )
      }
    }

    ws.onmessage = (event) => {
      const term = termRef.current
      if (!term) return

      if (typeof event.data === "string") {
        term.write(event.data)
      } else if (event.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(event.data))
      }
    }

    ws.onerror = () => {
      updateStatus("error")
    }

    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null
        updateStatus("disconnected")
      }
    }
  }, [workspaceId, updateStatus])

  useEffect(() => {
    onRegisterActions?.({
      clear: clearTerminal,
      reconnect: connect,
    })
  }, [onRegisterActions, clearTerminal, connect])

  // Initialize xterm.js instance
  useEffect(() => {
    if (!terminalRef.current) return

    const isDark =
      document.documentElement.classList.contains("dark") ||
      colorMode === "dark"

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      convertEol: true,
      fontSize: 12.5,
      lineHeight: 1.25,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      theme: isDark
        ? {
            background: "#09090b",
            foreground: "#fafafa",
            cursor: "#38bdf8",
            cursorAccent: "#09090b",
            selectionBackground: "#3f3f46",
            black: "#18181b",
            red: "#ef4444",
            green: "#22c55e",
            yellow: "#eab308",
            blue: "#3b82f6",
            magenta: "#d946ef",
            cyan: "#06b6d4",
            white: "#f4f4f5",
            brightBlack: "#71717a",
            brightRed: "#f87171",
            brightGreen: "#4ade80",
            brightYellow: "#fde047",
            brightBlue: "#60a5fa",
            brightMagenta: "#e879f9",
            brightCyan: "#22d3ee",
            brightWhite: "#ffffff",
          }
        : {
            background: "#ffffff",
            foreground: "#09090b",
            cursor: "#0284c7",
            cursorAccent: "#ffffff",
            selectionBackground: "#e4e4e7",
            black: "#09090b",
            red: "#dc2626",
            green: "#16a34a",
            yellow: "#ca8a04",
            blue: "#2563eb",
            magenta: "#c026d3",
            cyan: "#0891b2",
            white: "#f4f4f5",
            brightBlack: "#52525b",
            brightRed: "#ef4444",
            brightGreen: "#22c55e",
            brightYellow: "#eab308",
            brightBlue: "#3b82f6",
            brightMagenta: "#d946ef",
            brightCyan: "#06b6d4",
            brightWhite: "#18181b",
          },
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(terminalRef.current)

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Delay fit slightly to allow DOM layout to settle
    requestAnimationFrame(() => {
      try {
        fitAddon.fit()
      } catch {
        // ignore layout race
      }
    })

    // Forward user keystrokes to WebSocket
    const onDataDispose = term.onData((data) => {
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    // Forward resize events to backend PTY
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit()
        const ws = wsRef.current
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "resize",
              cols: term.cols,
              rows: term.rows,
            })
          )
        }
      } catch {
        // ignore
      }
    })
    resizeObserver.observe(terminalRef.current)

    // Connect to WebSocket
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      resizeObserver.disconnect()
      onDataDispose.dispose()
      if (wsRef.current) {
        try {
          wsRef.current.close()
        } catch {
          // ignore
        }
        wsRef.current = null
      }
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
    }
  }, [workspaceId, colorMode, connect])

  return (
    <div className="relative flex h-full w-full flex-col bg-background">
      {connectionStatus === "connecting" && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded bg-muted/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur-sm">
          <Loader2Icon className="size-3 animate-spin" />
          <span>Connecting to container...</span>
        </div>
      )}

      {connectionStatus === "disconnected" && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded border border-border bg-muted/90 px-2 py-1 text-xs text-muted-foreground backdrop-blur-sm">
          <span className="size-2 rounded-full bg-amber-500" />
          <span>Disconnected</span>
          <Button
            variant="ghost"
            size="xs"
            className="h-5 px-1.5 text-xs text-foreground hover:bg-background"
            onClick={connect}
          >
            <RefreshCwIcon className="mr-1 size-3" />
            Reconnect
          </Button>
        </div>
      )}

      {connectionStatus === "error" && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded border border-destructive/20 bg-destructive/10 px-2 py-1 text-xs text-destructive backdrop-blur-sm">
          <span className="size-2 rounded-full bg-destructive" />
          <span>Connection Failed</span>
          <Button
            variant="ghost"
            size="xs"
            className="h-5 px-1.5 text-xs text-destructive hover:bg-destructive/20"
            onClick={connect}
          >
            <RefreshCwIcon className="mr-1 size-3" />
            Retry
          </Button>
        </div>
      )}

      <div
        ref={terminalRef}
        className="h-full w-full overflow-hidden p-2"
        style={{ minHeight: "100px" }}
      />
    </div>
  )
}
