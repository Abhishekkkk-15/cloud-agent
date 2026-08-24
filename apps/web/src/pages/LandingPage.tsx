import { Link } from "react-router-dom"
import { SparklesIcon } from "lucide-react"

import { AppHeader } from "@/components/layout/AppHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <AppHeader />
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--muted)_0%,_transparent_55%)]" />
        <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-16">
          <div className="flex flex-col gap-5">
            <Badge variant="secondary" className="w-fit">
              Coding agent · browser workspace
            </Badge>
            <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">
              Cloud Agent
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Describe what you want to build. The agent opens a workspace with
              chat, code, preview, and console — Replit-style, mock data for now.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                render={<Link to="/login" />}
                nativeButton={false}
              >
                <SparklesIcon data-icon="inline-start" />
                Sign in with Google
              </Button>
              <Button
                size="lg"
                variant="outline"
                render={<Link to="/workspace/proj_1" />}
                nativeButton={false}
              >
                Open sample workspace
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
