import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import {
  Volume2Icon,
  VolumeXIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  BoxIcon,
  TerminalIcon,
  ShieldCheckIcon,
  ZapIcon,
  ExternalLinkIcon,
  XIcon,
  GitBranchIcon,
} from "lucide-react"

function BrandEmblem({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      className={className}
      aria-label="Cloud Agent Emblem"
    >
      <path d="M16 2C16 8 20 12 26 12C20 12 16 16 16 22C16 16 12 12 6 12C12 12 16 8 16 2Z" />
      <circle cx="16" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export function DigitalArchiveHero() {
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })
  const [activeModal, setActiveModal] = useState<"manifesto" | "sandbox" | "terminal" | null>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window
      const x = (e.clientX - innerWidth / 2) / (innerWidth / 2)
      const y = (e.clientY - innerHeight / 2) / (innerHeight / 2)
      // Gentle subtle 3D tilt
      setTilt({
        rx: -y * 6,
        ry: x * 8,
      })
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true })
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [])

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden select-none">
      {/* ======================================================== */}
      {/* TOP FLOATING CAPSULE NAVIGATION                          */}
      {/* ======================================================== */}
      <header className="relative z-30 pt-6 px-4 flex justify-center w-full">
        <nav
          className="inline-flex items-center gap-4 sm:gap-7 rounded-full border border-white/25 bg-black/20 px-5 sm:px-8 py-2.5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.35)] text-white/85 text-[11px] sm:text-[12px] font-sans font-medium tracking-[0.2em] uppercase transition-all duration-300 hover:border-white/40 hover:bg-black/25"
          style={{
            transform: `perspective(800px) rotateX(${tilt.rx * 0.4}deg) rotateY(${tilt.ry * 0.4}deg)`,
          }}
        >
          <Link
            to="/dashboard"
            className="transition-colors hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]"
          >
            Workspaces
          </Link>
          <button
            type="button"
            onClick={() => setActiveModal("terminal")}
            className="transition-colors hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]"
          >
            Terminal
          </button>

          {/* Central White Gold Emblem */}
          <Link
            to="/"
            className="group px-1 flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
            title="Cloud Agent Home"
          >
            <BrandEmblem className="size-5 text-amber-200 group-hover:text-amber-100 transition-colors drop-shadow-[0_0_10px_rgba(255,230,160,0.8)]" />
          </Link>

          <button
            type="button"
            onClick={() => setActiveModal("sandbox")}
            className="transition-colors hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]"
          >
            Sandbox
          </button>
          <button
            type="button"
            onClick={() => setActiveModal("manifesto")}
            className="transition-colors hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]"
          >
            Manifesto
          </button>
        </nav>
      </header>

      {/* ======================================================== */}
      {/* MONUMENTAL CENTERPIECE HERO                              */}
      {/* ======================================================== */}
      <main className="relative z-20 flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
        <div
          className="flex flex-col items-center max-w-4xl transition-transform duration-200 ease-out"
          style={{
            transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
            transformStyle: "preserve-3d",
          }}
        >
          {/* Overline Tracking Monospace / Serif */}
          <div
            className="mb-4 sm:mb-6 flex flex-col items-center gap-1.5 opacity-90"
            style={{ transform: "translateZ(30px)" }}
          >
            <span className="text-[11px] sm:text-xs font-sans font-semibold tracking-[0.35em] text-amber-200 uppercase drop-shadow-sm">
              Autonomous Intelligence
            </span>
            <span className="text-[10px] sm:text-[11px] font-sans font-medium tracking-[0.28em] text-amber-100/70 uppercase">
              Container-Native Runtime
            </span>
          </div>

          {/* Monumental Headline */}
          <h1
            className="font-serif text-5xl sm:text-8xl md:text-9xl font-light tracking-[0.03em] text-white leading-none drop-shadow-[0_15px_45px_rgba(0,0,0,0.65)]"
            style={{ transform: "translateZ(50px)" }}
          >
            DIGITAL
            <span className="block mt-1 sm:mt-3 tracking-[0.04em]">ARCHIVE</span>
          </h1>

          {/* Poetic Subtitle */}
          <p
            className="mt-6 sm:mt-8 max-w-xl font-serif italic text-base sm:text-lg md:text-xl text-amber-100/90 leading-relaxed drop-shadow-[0_4px_12px_rgba(0,0,0,0.7)] px-4"
            style={{ transform: "translateZ(35px)" }}
          >
            A sanctuary honoring the makers, visionaries and creators who turned natural thought into living, isolated reality.
          </p>

          {/* Pill Action Button */}
          <div className="mt-8 sm:mt-10" style={{ transform: "translateZ(60px)" }}>
            <Link
              to="/login"
              className="group relative inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 px-8 sm:px-10 py-3 sm:py-3.5 text-xs sm:text-sm font-sans font-medium tracking-[0.25em] text-white uppercase backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-all duration-300 hover:border-amber-200/80 hover:bg-white/20 hover:scale-105 hover:shadow-[0_0_35px_rgba(255,230,170,0.4)] active:scale-95"
            >
              <span className="relative z-10 flex items-center gap-2">
                <span>Enter Runtime</span>
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </span>
              <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-amber-300/20 via-white/10 to-amber-300/20 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" />
            </Link>
          </div>
        </div>
      </main>

      {/* ======================================================== */}
      {/* BOTTOM STATUS & NAVIGATION BAR                           */}
      {/* ======================================================== */}
      <footer className="relative z-30 pb-6 px-6 sm:px-10 flex items-center justify-between text-[11px] font-sans font-medium tracking-[0.18em] uppercase text-white/70">
        {/* Left: Socials & Privacy */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3 text-white/80">
            <a
              href="https://github.com/Abhishekkkk-15/cloud-agent"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-white"
              title="GitHub Repository"
            >
              <GithubIcon className="size-3.5" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-white"
              title="Twitter"
            >
              <TwitterIcon className="size-3.5" />
            </a>
          </div>
          <button
            type="button"
            onClick={() => setActiveModal("manifesto")}
            className="hover:text-white transition-colors"
          >
            Privacy Notice
          </button>
        </div>

        {/* Right: Terms, Audio Pulse, Settings */}
        <div className="flex items-center gap-4 sm:gap-6">
          <button
            type="button"
            onClick={() => setActiveModal("manifesto")}
            className="hover:text-white transition-colors hidden sm:inline-block"
          >
            Terms & Policies
          </button>

          {/* Ambient Sound / Pulse Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex items-center gap-1.5 transition-colors hover:text-white"
            title={soundEnabled ? "Mute Atmosphere" : "Enable Ambient Breeze"}
          >
            {soundEnabled ? (
              <>
                <Volume2Icon className="size-3.5 text-amber-200 animate-pulse" />
                <span className="hidden sm:inline text-[10px] text-amber-200">Atmosphere On</span>
              </>
            ) : (
              <>
                <VolumeXIcon className="size-3.5 text-white/60" />
                <span className="hidden sm:inline text-[10px]">Muted</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveModal("sandbox")}
            className="transition-colors hover:text-white"
            title="Sandbox Parameters"
          >
            <SlidersHorizontalIcon className="size-3.5" />
          </button>
        </div>
      </footer>

      {/* ======================================================== */}
      {/* INTERACTIVE EDITORIAL MODAL (MANIFESTO / SANDBOX / TERMINAL) */}
      {/* ======================================================== */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-2xl rounded-2xl border border-white/20 bg-stone-950/80 p-6 sm:p-8 text-white shadow-2xl backdrop-blur-2xl"
            style={{
              backgroundImage: "radial-gradient(ellipse at top, rgba(212, 151, 59, 0.12), transparent 70%)",
            }}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-5 right-5 rounded-full p-1 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <XIcon className="size-5" />
            </button>

            {/* Modal Content Based on Selection */}
            {activeModal === "manifesto" && (
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 text-xs font-sans tracking-[0.25em] text-amber-200 uppercase">
                  <SparklesIcon className="size-3.5 text-amber-300" />
                  <span>The Autonomous Manifesto</span>
                </div>
                <h3 className="font-serif text-3xl sm:text-4xl font-light text-white">
                  Where Ideas Take Flight
                </h3>
                <p className="font-serif italic text-amber-100/80 text-sm sm:text-base leading-relaxed">
                  We believe that writing software should not feel like fighting boilerplate, managing local environments, or enduring security risks on your host system.
                </p>
                <div className="border-t border-white/10 pt-4 text-xs font-sans text-stone-300 space-y-2 leading-relaxed">
                  <p>
                    Cloud Agent provides an impenetrable digital archive: an autonomous engineer executing directly inside pure Docker container volumes, crafting code across multiple files, testing in real time, and delivering instant subdomains.
                  </p>
                  <p>
                    Every keystroke, commit, and build is isolated, autonomous, and beautiful.
                  </p>
                </div>
                <div className="pt-4 flex justify-end">
                  <Link
                    to="/login"
                    onClick={() => setActiveModal(null)}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/10 px-5 py-2 text-xs font-sans uppercase tracking-[0.2em] text-amber-200 hover:bg-amber-400/20 transition-all"
                  >
                    <span>Launch Runtime</span>
                    <ExternalLinkIcon className="size-3.5" />
                  </Link>
                </div>
              </div>
            )}

            {activeModal === "sandbox" && (
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 text-xs font-sans tracking-[0.25em] text-amber-200 uppercase">
                  <BoxIcon className="size-3.5 text-amber-300" />
                  <span>Container-Native Architecture</span>
                </div>
                <h3 className="font-serif text-3xl sm:text-4xl font-light text-white">
                  Isolated Docker Volumes
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
                    <ShieldCheckIcon className="size-4 text-emerald-400 mb-2" />
                    <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Zero Host Exposure</h4>
                    <p className="text-[11px] text-stone-300 mt-1">Untrusted repos & agent tool executions live strictly within isolated Docker volumes.</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
                    <ZapIcon className="size-4 text-amber-400 mb-2" />
                    <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Sub-second Spin-up</h4>
                    <p className="text-[11px] text-stone-300 mt-1">Pre-warmed Debian sandbox pool boots instantaneous fullstack environments.</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
                    <TerminalIcon className="size-4 text-sky-400 mb-2" />
                    <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Dual Preview Proxy</h4>
                    <p className="text-[11px] text-stone-300 mt-1">Automatic reverse-proxy streaming ports 4000 (Vite) and 3000 (Next.js) directly to browser.</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
                    <GitBranchIcon className="size-4 text-purple-400 mb-2" />
                    <h4 className="text-xs font-semibold text-white uppercase tracking-wider">In-Container Git</h4>
                    <p className="text-[11px] text-stone-300 mt-1">Direct origin sync, automated checkpoints, and clean GitHub push integration.</p>
                  </div>
                </div>
              </div>
            )}

            {activeModal === "terminal" && (
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 text-xs font-sans tracking-[0.25em] text-amber-200 uppercase">
                  <TerminalIcon className="size-3.5 text-amber-300" />
                  <span>Direct Container Terminal</span>
                </div>
                <h3 className="font-serif text-3xl font-light text-white">
                  Real-time Interactive Shell
                </h3>
                <div className="rounded-xl border border-white/15 bg-black/80 p-4 font-mono text-xs text-amber-200/90 space-y-1.5 shadow-inner">
                  <div className="text-white/40"># Container: sandbox-ca-9271a (Ubuntu/Node 20 / Python 3.12)</div>
                  <div className="text-white/40"># Workdir: /app (Docker Dedicated Volume)</div>
                  <div className="pt-2 text-emerald-400">$ cloud-agent build --stack=fullstack</div>
                  <div className="text-stone-300">✓ Container sandbox initialized in 280ms</div>
                  <div className="text-stone-300">✓ Git origin configured inside volume</div>
                  <div className="text-stone-300">✓ Preview proxy active at https://preview-ca-9271a.cloud-agent.dev</div>
                  <div className="text-amber-300 animate-pulse">$ ready for natural language instructions_</div>
                </div>
                <div className="pt-2 flex justify-between items-center text-xs text-stone-400">
                  <span>Full Monaco & XTerm integration inside workspace</span>
                  <Link
                    to="/dashboard"
                    onClick={() => setActiveModal(null)}
                    className="inline-flex items-center gap-1.5 text-amber-200 hover:text-amber-100 uppercase tracking-widest text-[11px]"
                  >
                    <span>Open Workspace</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
