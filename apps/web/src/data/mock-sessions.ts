import type { MinimalSession } from "@cloud-agent/shared"

export type WorkspaceSession = MinimalSession & {
  workspace_id: string
  updated_at?: string
}

export const mockSessions: WorkspaceSession[] = [
  {
    id: "sess_1a",
    workspace_id: "ws_1",
    title: "Auth layout",
    updated_at: "2026-08-24T10:00:00.000Z",
  },
  {
    id: "sess_1b",
    workspace_id: "ws_1",
    title: "Realtime charts",
    updated_at: "2026-08-23T16:20:00.000Z",
  },
  {
    id: "sess_1c",
    workspace_id: "ws_1",
    title: "Dark theme polish",
    updated_at: "2026-08-21T09:12:00.000Z",
  },
  {
    id: "sess_2a",
    workspace_id: "ws_2",
    title: "JWT login",
    updated_at: "2026-08-19T18:05:00.000Z",
  },
  {
    id: "sess_2b",
    workspace_id: "ws_2",
    title: "Notes CRUD",
    updated_at: "2026-08-18T11:40:00.000Z",
  },
  {
    id: "sess_3a",
    workspace_id: "ws_3",
    title: "Hot reload",
    updated_at: "2026-08-18T08:41:00.000Z",
  },
  {
    id: "sess_4a",
    workspace_id: "ws_4",
    title: "Landing copy",
    updated_at: "2026-08-15T21:10:00.000Z",
  },
  {
    id: "sess_4b",
    workspace_id: "ws_4",
    title: "Blog index",
    updated_at: "2026-08-14T13:00:00.000Z",
  },
  {
    id: "sess_5a",
    workspace_id: "ws_5",
    title: "Embed snippet",
    updated_at: "2026-08-12T12:00:00.000Z",
  },
  {
    id: "sess_6a",
    workspace_id: "ws_6",
    title: "WASM boot",
    updated_at: "2026-08-10T07:55:00.000Z",
  },
  {
    id: "sess_6b",
    workspace_id: "ws_6",
    title: "Memory sandbox",
    updated_at: "2026-08-09T19:22:00.000Z",
  },
]

export function sessionsForWorkspace(workspaceId: string): MinimalSession[] {
  const owned = mockSessions.filter(
    (session) => session.workspace_id === workspaceId
  )
  if (owned.length > 0) {
    return owned.map(({ id, title }) => ({ id, title }))
  }
  return [{ id: `${workspaceId}_main`, title: "Main session" }]
}
