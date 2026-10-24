import { create } from "zustand"

import { getCurrentUser, googleSignIn } from "@/lib/api"
import { clearTokens, setTokens } from "@/lib/http"
import type { User } from "@cloud-agent/shared"

type AuthState = {
  user: User | null
  loading: boolean
  error: string | null
  hydrate: () => Promise<void>
  signInWithGoogle: (credential: string) => Promise<void>
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
      clearTokens()
      set({
        user: null,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load user",
      })
    }
  },
  signInWithGoogle: async (credential) => {
    set({ error: null })
    const payload = await googleSignIn(credential)
    setTokens(payload.access_token, payload.refresh_token)
    set({ user: payload.user, loading: false, error: null })
  },
  signOut: () => {
    clearTokens()
    set({ user: null, error: null })
  },
}))
