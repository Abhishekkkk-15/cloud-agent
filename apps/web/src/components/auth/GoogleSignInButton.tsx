import { GoogleLogin } from "@react-oauth/google"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"

import { getApiErrorMessage } from "@/lib/http"
import { useAuthStore } from "@/stores/auth-store"

type GoogleSignInButtonProps = {
  redirectTo?: string
}

export function GoogleSignInButton({
  redirectTo = "/dashboard",
}: GoogleSignInButtonProps) {
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const navigate = useNavigate()
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

  if (!clientId) {
    return (
      <p className="text-sm text-muted-foreground">
        Set <code>VITE_GOOGLE_CLIENT_ID</code> in <code>apps/web/.env</code> to
        enable Google sign-in.
      </p>
    )
  }

  return (
    <GoogleLogin
      onSuccess={async (response) => {
        if (!response.credential) {
          toast.error("Google did not return a credential")
          return
        }
        try {
          await signInWithGoogle(response.credential)
          navigate(redirectTo, { replace: true })
        } catch (error) {
          toast.error(getApiErrorMessage(error, "Google sign-in failed"))
        }
      }}
      onError={() => toast.error("Google sign-in was cancelled")}
      useOneTap
      width={320}
    />
  )
}
