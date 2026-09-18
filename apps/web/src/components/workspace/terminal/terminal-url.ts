import { getAccessToken } from "@/lib/http"

export function getTerminalWsUrl(workspaceId: string): string {
  const searchParams = new URLSearchParams()
  searchParams.set("workspace_id", workspaceId)

  const token = getAccessToken()
  if (token) {
    searchParams.set("token", token)
  }

  const wsBase = (import.meta.env.VITE_WS_URL || "").replace(/\/$/, "")
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  const baseUrl = wsBase
    ? `${wsBase}/ws/terminal`
    : `${protocol}//${window.location.host}/ws/terminal`

  return `${baseUrl}?${searchParams.toString()}`
}
