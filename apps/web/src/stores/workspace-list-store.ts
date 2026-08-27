import { create } from "zustand"

import { createSession, createWorkspace, listWorkspaces } from "@/lib/api"
import { getApiErrorMessage } from "@/lib/http"
import type {
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
  Session,
  WorkspaceWithSession,
} from "@cloud-agent/shared"

type WorkspaceListState = {
  workspaces: WorkspaceWithSession[]
  loading: boolean
  creating: boolean
  creatingSessionFor: string | null
  query: string
  error: string | null
  setQuery: (query: string) => void
  fetchWorkspaces: (query?: string) => Promise<void>
  create: (
    input: CreateWorkspaceRequest
  ) => Promise<CreateWorkspaceResponse>
  createSessionForWorkspace: (workspaceId: string) => Promise<Session>
}

export const useWorkspaceListStore = create<WorkspaceListState>((set, get) => ({
  workspaces: [],
  loading: false,
  creating: false,
  creatingSessionFor: null,
  query: "",
  error: null,
  setQuery: (query) => set({ query }),
  fetchWorkspaces: async (query) => {
    set({ loading: true, error: null })
    try {
      const workspaces = await listWorkspaces(query ?? get().query)
      set({ workspaces, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: getApiErrorMessage(error, "Failed to load workspaces"),
      })
    }
  },
  create: async (input) => {
    set({ creating: true, error: null })
    try {
      const created = await createWorkspace(input)
      const workspaces = await listWorkspaces(get().query)
      set({ workspaces, creating: false })
      return created
    } catch (error) {
      set({
        creating: false,
        error: getApiErrorMessage(error, "Failed to create workspace"),
      })
      throw error
    }
  },
  createSessionForWorkspace: async (workspaceId) => {
    set({ creatingSessionFor: workspaceId, error: null })
    try {
      const session = await createSession(workspaceId)
      const workspaces = await listWorkspaces(get().query)
      set({ workspaces, creatingSessionFor: null })
      return session
    } catch (error) {
      set({
        creatingSessionFor: null,
        error: getApiErrorMessage(error, "Failed to create session"),
      })
      throw error
    }
  },
}))
