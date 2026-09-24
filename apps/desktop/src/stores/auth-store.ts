import { create } from "zustand"

export interface User {
  id: string
  name: string
  email: string
  role: "admin" | "user"
  picture?: string
}

type AuthState = {
  user: User | null
  signOut: () => void
}

export const useAuthStore = create<AuthState>(() => ({
  user: {
    id: "usr-local-owner",
    name: "Abhishek",
    email: "abhishek@local.dev",
    role: "admin",
  },
  signOut: () => {},
}))
