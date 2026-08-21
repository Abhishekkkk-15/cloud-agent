import { create } from "zustand"

import { getCurrentUser } from "@/lib/api"
import type { User } from "@/types/schemas"

type AuthState = {
  user: User | null
  loading: boolean
  error: string | null
  hydrate: () => Promise<void>
  signOut: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  error: null,
  hydrate: async () => {
    set({ loading: true, error: null })
    try {
      const user = await getCurrentUser()
      set({ user, loading: false })
    } catch (error) {
      set({
        user: null,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load user",
      })
    }
  },
  signOut: () => set({ user: null }),
}))
