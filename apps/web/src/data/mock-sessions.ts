export type ProjectSession = {
  id: string
  projectId: string
  title: string
  updatedAt: string
}

export const mockSessions: ProjectSession[] = [
  {
    id: "sess_1a",
    projectId: "proj_1",
    title: "Auth layout",
    updatedAt: "2026-08-24T10:00:00.000Z",
  },
  {
    id: "sess_1b",
    projectId: "proj_1",
    title: "Realtime charts",
    updatedAt: "2026-08-23T16:20:00.000Z",
  },
  {
    id: "sess_1c",
    projectId: "proj_1",
    title: "Dark theme polish",
    updatedAt: "2026-08-21T09:12:00.000Z",
  },
  {
    id: "sess_2a",
    projectId: "proj_2",
    title: "JWT login",
    updatedAt: "2026-08-19T18:05:00.000Z",
  },
  {
    id: "sess_2b",
    projectId: "proj_2",
    title: "Notes CRUD",
    updatedAt: "2026-08-18T11:40:00.000Z",
  },
  {
    id: "sess_3a",
    projectId: "proj_3",
    title: "Hot reload",
    updatedAt: "2026-08-18T08:41:00.000Z",
  },
  {
    id: "sess_4a",
    projectId: "proj_4",
    title: "Landing copy",
    updatedAt: "2026-08-15T21:10:00.000Z",
  },
  {
    id: "sess_4b",
    projectId: "proj_4",
    title: "Blog index",
    updatedAt: "2026-08-14T13:00:00.000Z",
  },
  {
    id: "sess_5a",
    projectId: "proj_5",
    title: "Embed snippet",
    updatedAt: "2026-08-12T12:00:00.000Z",
  },
  {
    id: "sess_6a",
    projectId: "proj_6",
    title: "WASM boot",
    updatedAt: "2026-08-10T07:55:00.000Z",
  },
  {
    id: "sess_6b",
    projectId: "proj_6",
    title: "Memory sandbox",
    updatedAt: "2026-08-09T19:22:00.000Z",
  },
]

export function sessionsForProject(projectId: string): ProjectSession[] {
  const owned = mockSessions.filter((session) => session.projectId === projectId)
  if (owned.length > 0) return owned
  return [
    {
      id: `${projectId}_main`,
      projectId,
      title: "Main session",
      updatedAt: new Date().toISOString(),
    },
  ]
}
