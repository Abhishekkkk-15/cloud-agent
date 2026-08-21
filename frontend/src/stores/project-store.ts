import { create } from "zustand"

import {
  createProject,
  listProjects,
  toggleStar,
} from "@/lib/api"
import type { CreateProjectInput, Project } from "@/types/schemas"

type ProjectState = {
  projects: Project[]
  loading: boolean
  creating: boolean
  query: string
  error: string | null
  setQuery: (query: string) => void
  fetchProjects: (query?: string) => Promise<void>
  create: (input: CreateProjectInput) => Promise<Project>
  star: (id: string) => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  loading: false,
  creating: false,
  query: "",
  error: null,
  setQuery: (query) => set({ query }),
  fetchProjects: async (query) => {
    set({ loading: true, error: null })
    try {
      const projects = await listProjects(query ?? get().query)
      set({ projects, loading: false })
    } catch (error) {
      set({
        loading: false,
        error:
          error instanceof Error ? error.message : "Failed to load projects",
      })
    }
  },
  create: async (input) => {
    set({ creating: true, error: null })
    try {
      const project = await createProject(input)
      set((state) => ({
        projects: [project, ...state.projects],
        creating: false,
      }))
      return project
    } catch (error) {
      set({
        creating: false,
        error:
          error instanceof Error ? error.message : "Failed to create project",
      })
      throw error
    }
  },
  star: async (id) => {
    const project = await toggleStar(id)
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? project : p)),
    }))
  },
}))
