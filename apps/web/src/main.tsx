import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { GoogleOAuthProvider } from "@react-oauth/google"

import { ThemeProvider } from "@/components/theme-provider.tsx"

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""

const app = (
  <ThemeProvider>
    <App />
  </ThemeProvider>
)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {googleClientId ? (
      <GoogleOAuthProvider clientId={googleClientId}>{app}</GoogleOAuthProvider>
    ) : (
      app
    )}
  </StrictMode>
)
