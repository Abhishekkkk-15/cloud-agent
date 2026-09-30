import { useState } from "react"
import { Link } from "react-router-dom"
import {
  SparklesIcon,
  BoxIcon,
  CheckIcon,
} from "lucide-react"

import { AppHeader } from "@/components/layout/AppHeader"
import { Button } from "@/components/ui/button"
import { HeroScene3D } from "@/components/landing/HeroScene3D"
import { HeroWorkspace3D } from "@/components/landing/HeroWorkspace3D"
import { HeroPromptInput } from "@/components/landing/HeroPromptInput"
import { HeroMetrics } from "@/components/landing/HeroMetrics"

function GithubLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

export function LandingPage() {
  const [activePreset, setActivePreset] = useState("kanban")

  return (
    <div className="relative flex min-h-svh flex-col bg-background text-foreground selection:bg-primary/20 selection:text-primary overflow-x-hidden">
      {/* 3D Background Canvas */}
      <HeroScene3D />

      {/* Top Header */}
      <AppHeader className="relative z-20 border-b border-border/50 bg-background/60 backdrop-blur-xl" />

      <main className="relative z-10 flex flex-1 flex-col items-center">
        {/* ======================================================== */}
        {/* HERO SECTION                                            */}
        {/* ======================================================== */}
        <section className="relative flex w-full flex-col items-center px-4 pt-12 pb-16 md:pt-20 md:pb-24 text-center">
          {/* Announcement Chip */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-medium text-primary shadow-sm backdrop-blur-md transition-all hover:bg-primary/15">
            <SparklesIcon className="size-3.5 text-sky-400 animate-pulse" />
            <span>Container-Native Sandboxes · Docker Volumes & Fullstack Previews</span>
          </div>

          {/* Monumental Headline */}
          <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight sm:text-6xl md:text-7xl">
            Autonomous Coding in{" "}
            <span className="bg-gradient-to-r from-sky-400 via-primary to-purple-500 bg-clip-text text-transparent">
              Isolated 3D Sandboxes
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            Describe what you want to build. Cloud Agent boots a secure Docker
            container, coordinates multi-file edits, runs builds, and serves live fullstack
            previews with instant subdomains.
          </p>

          {/* Prompt Generator Input with presets */}
          <div className="mt-8 w-full">
            <HeroPromptInput onPresetChange={setActivePreset} />
          </div>

          {/* Quick CTAs */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              render={<Link to="/login" />}
              nativeButton={false}
              className="gap-2 shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all font-medium rounded-xl"
            >
              <SparklesIcon className="size-4" />
              Start Building Free
            </Button>
            <Button
              size="lg"
              variant="outline"
              render={<Link to="/dashboard" />}
              nativeButton={false}
              className="gap-2 rounded-xl backdrop-blur-md hover:bg-muted/80 transition-all"
            >
              <BoxIcon className="size-4 text-primary" />
              Open Dashboard
            </Button>
          </div>

          {/* Feature Checklist */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckIcon className="size-3.5 text-emerald-400" /> Docker Volume Isolation
            </span>
            <span className="flex items-center gap-1.5">
              <CheckIcon className="size-3.5 text-emerald-400" /> Port 4000/3000 Preview Proxy
            </span>
            <span className="flex items-center gap-1.5">
              <CheckIcon className="size-3.5 text-emerald-400" /> Monaco Editor & XTerm
            </span>
            <span className="flex items-center gap-1.5">
              <CheckIcon className="size-3.5 text-emerald-400" /> Automated Git Checkpoints
            </span>
          </div>

          {/* ======================================================== */}
          {/* 3D FLOATING WORKSPACE SHOWCASE                           */}
          {/* ======================================================== */}
          <div className="mt-12 w-full">
            <HeroWorkspace3D activePreset={activePreset} />
          </div>

          {/* ======================================================== */}
          {/* ARCHITECTURAL METRICS & CAPABILITIES PILLARS             */}
          {/* ======================================================== */}
          <HeroMetrics />
        </section>
      </main>

      {/* Modern Footer */}
      <footer className="relative z-10 border-t border-border/50 bg-background/80 py-8 px-6 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded bg-primary text-primary-foreground font-bold text-[10px]">
              CA
            </span>
            <span className="font-medium text-foreground">Cloud Agent</span>
            <span>— Container-Native AI Software Engineer</span>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/login" className="hover:text-foreground transition-colors">
              Sign In
            </Link>
            <Link to="/dashboard" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <a
              href="https://github.com/Abhishekkkk-15/cloud-agent"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              <GithubLogo className="size-3.5" />
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
