import { create } from "zustand"
import { useWorkspaceStore } from "./workspace-store"
import type { WorkspaceWithSession, Session } from "@cloud-agent/shared"

type WorkspaceListState = {
  workspaces: WorkspaceWithSession[]
  loading: boolean
  creating: boolean
  creatingSessionFor: string | null
  itemActionBusy: boolean
  query: string
  error: string | null
  setQuery: (query: string) => void
  fetchWorkspaces: (query?: string) => Promise<void>
  createSessionForWorkspace: (workspaceId: string) => Promise<Session>
  renameWorkspace: (workspaceId: string, title: string) => Promise<void>
  renameSession: (workspaceId: string, sessionId: string, title: string) => Promise<void>
  removeWorkspace: (workspaceId: string) => Promise<void>
  removeSession: (workspaceId: string, sessionId: string) => Promise<void>
}

export const useWorkspaceListStore = create<WorkspaceListState>((set) => ({
  workspaces: useWorkspaceStore.getState().workspaces,
  loading: false,
  creating: false,
  creatingSessionFor: null,
  itemActionBusy: false,
  query: "",
  error: null,
  setQuery: (query) => set({ query }),
  fetchWorkspaces: async () => {
    set({ workspaces: useWorkspaceStore.getState().workspaces })
  },
  createSessionForWorkspace: async (workspaceId: string) => {
    const s = await useWorkspaceStore.getState().createSessionForWorkspace(workspaceId)
    set({ workspaces: useWorkspaceStore.getState().workspaces })
    return s
  },
  renameWorkspace: async (workspaceId: string, title: string) => {
    await useWorkspaceStore.getState().renameWorkspace(workspaceId, title)
    set({ workspaces: useWorkspaceStore.getState().workspaces })
  },
  renameSession: async (workspaceId: string, sessionId: string, title: string) => {
    await useWorkspaceStore.getState().renameSession(workspaceId, sessionId, title)
    set({ workspaces: useWorkspaceStore.getState().workspaces })
  },
  removeWorkspace: async (workspaceId: string) => {
    await useWorkspaceStore.getState().removeWorkspace(workspaceId)
    set({ workspaces: useWorkspaceStore.getState().workspaces })
  },
  removeSession: async (workspaceId: string, sessionId: string) => {
    await useWorkspaceStore.getState().removeSession(workspaceId, sessionId)
    set({ workspaces: useWorkspaceStore.getState().workspaces })
  },
}))

// Synchronize with workspace-store
useWorkspaceStore.subscribe((state) => {
  useWorkspaceListStore.setState({ workspaces: state.workspaces })
})
