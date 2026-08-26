import { create } from "zustand"

import { createWorkspace, listWorkspaces } from "@/lib/api"
import { getApiErrorMessage } from "@/lib/http"
import type {
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
  WorkspaceWithSession,
} from "@cloud-agent/shared"

type WorkspaceListState = {
  workspaces: WorkspaceWithSession[]
  loading: boolean
  creating: boolean
  query: string
  error: string | null
  setQuery: (query: string) => void
  fetchWorkspaces: (query?: string) => Promise<void>
  create: (
    input: CreateWorkspaceRequest
  ) => Promise<CreateWorkspaceResponse>
}

export const useWorkspaceListStore = create<WorkspaceListState>((set, get) => ({
  workspaces: [],
  loading: false,
  creating: false,
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
}))
