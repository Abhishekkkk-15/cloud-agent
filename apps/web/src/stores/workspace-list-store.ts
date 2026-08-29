import { create } from "zustand"

import {
  createSession,
  createWorkspace,
  deleteSession,
  deleteWorkspace,
  listWorkspaces,
  updateSessionTitle,
  updateWorkspaceTitle,
} from "@/lib/api"
import { getApiErrorMessage } from "@/lib/http"
import { useWorkspaceStore } from "@/stores/workspace-store"
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
  itemActionBusy: boolean
  query: string
  error: string | null
  setQuery: (query: string) => void
  fetchWorkspaces: (query?: string) => Promise<void>
  create: (
    input: CreateWorkspaceRequest
  ) => Promise<CreateWorkspaceResponse>
  createSessionForWorkspace: (workspaceId: string) => Promise<Session>
  renameWorkspace: (workspaceId: string, title: string) => Promise<void>
  renameSession: (
    workspaceId: string,
    sessionId: string,
    title: string
  ) => Promise<void>
  removeWorkspace: (workspaceId: string) => Promise<void>
  removeSession: (workspaceId: string, sessionId: string) => Promise<void>
}

export const useWorkspaceListStore = create<WorkspaceListState>((set, get) => ({
  workspaces: [],
  loading: false,
  creating: false,
  creatingSessionFor: null,
  itemActionBusy: false,
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
  renameWorkspace: async (workspaceId, title) => {
    set({ itemActionBusy: true, error: null })
    try {
      await updateWorkspaceTitle(workspaceId, title)
      const workspaces = await listWorkspaces(get().query)
      set({ workspaces, itemActionBusy: false })

      const activeWorkspace = useWorkspaceStore.getState().workspace
      if (activeWorkspace?.id === workspaceId) {
        useWorkspaceStore.setState({
          workspace: { ...activeWorkspace, title },
        })
      }
    } catch (error) {
      set({
        itemActionBusy: false,
        error: getApiErrorMessage(error, "Failed to rename workspace"),
      })
      throw error
    }
  },
  renameSession: async (_workspaceId, sessionId, title) => {
    set({ itemActionBusy: true, error: null })
    try {
      await updateSessionTitle(sessionId, title)
      const workspaces = await listWorkspaces(get().query)
      set({ workspaces, itemActionBusy: false })
    } catch (error) {
      set({
        itemActionBusy: false,
        error: getApiErrorMessage(error, "Failed to rename session"),
      })
      throw error
    }
  },
  removeWorkspace: async (workspaceId) => {
    set({ itemActionBusy: true, error: null })
    try {
      await deleteWorkspace(workspaceId)
      const workspaces = await listWorkspaces(get().query)
      set({ workspaces, itemActionBusy: false })

      const activeWorkspace = useWorkspaceStore.getState().workspace
      if (activeWorkspace?.id === workspaceId) {
        useWorkspaceStore.setState({ workspace: null, chatMessages: [] })
      }
    } catch (error) {
      set({
        itemActionBusy: false,
        error: getApiErrorMessage(error, "Failed to delete workspace"),
      })
      throw error
    }
  },
  removeSession: async (_workspaceId, sessionId) => {
    set({ itemActionBusy: true, error: null })
    try {
      await deleteSession(sessionId)
      const workspaces = await listWorkspaces(get().query)
      set({ workspaces, itemActionBusy: false })

      const activeSessionId = useWorkspaceStore.getState().activeSessionId
      if (activeSessionId === sessionId) {
        useWorkspaceStore.setState({
          activeSessionId: null,
          chatMessages: [],
        })
      }
    } catch (error) {
      set({
        itemActionBusy: false,
        error: getApiErrorMessage(error, "Failed to delete session"),
      })
      throw error
    }
  },
}))
