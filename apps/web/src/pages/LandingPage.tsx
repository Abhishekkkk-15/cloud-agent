import { DigitalArchiveScene } from "@/components/landing/DigitalArchiveScene"
import { DigitalArchiveHero } from "@/components/landing/DigitalArchiveHero"
import { ShieldCheckIcon, TerminalIcon, ZapIcon, GitBranchIcon, SparklesIcon } from "lucide-react"
import { Link } from "react-router-dom"

export function LandingPage() {
  return (
    <div className="relative min-h-screen bg-stone-950 text-white selection:bg-amber-400/30 selection:text-amber-100 overflow-x-hidden font-sans">
      {/* 3D Atmospheric Canvas (Renaissance Sky + Parallax Soaring Doves + Light Motes) */}
      <DigitalArchiveScene />

      {/* Main Ethereal Hero Viewport (Exact 1:1 Vibe with Reference) */}
      <DigitalArchiveHero />

      {/* ======================================================== */}
      {/* SECTION 2: ARCHITECTURAL GALLERY (SUBTLE SCROLL REVEAL) */}
      {/* ======================================================== */}
      <section className="relative z-20 border-t border-white/10 bg-gradient-to-b from-stone-950/80 via-stone-950/95 to-black px-6 py-24 backdrop-blur-2xl">
        <div className="mx-auto max-w-5xl">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold tracking-[0.3em] uppercase text-amber-200">
              The Engine Room
            </span>
            <h2 className="mt-3 font-serif text-3xl sm:text-5xl font-light text-white">
              Sovereign Execution in Pure Isolation
            </h2>
            <p className="mt-4 font-serif italic text-amber-100/75 text-base sm:text-lg">
              Behind the serenity lies an industrial-grade container runtime built for autonomous code synthesis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pillar 1 */}
            <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl transition-all duration-300 hover:border-amber-300/30 hover:bg-white/[0.06]">
              <div className="flex size-12 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/20 mb-6">
                <ShieldCheckIcon className="size-6" />
              </div>
              <h3 className="font-serif text-2xl font-light text-white">
                Zero-Trust Container Sandboxes
              </h3>
              <p className="mt-3 text-sm text-stone-300 leading-relaxed font-sans font-light">
                All untrusted code, clone operations, package installs, and builds are strictly mounted to dedicated Docker volumes at <code className="text-amber-200">/app</code>. The host operating system remains untouched and unreachable.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl transition-all duration-300 hover:border-amber-300/30 hover:bg-white/[0.06]">
              <div className="flex size-12 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/20 mb-6">
                <ZapIcon className="size-6" />
              </div>
              <h3 className="font-serif text-2xl font-light text-white">
                Sub-Second Workspace Boot
              </h3>
              <p className="mt-3 text-sm text-stone-300 leading-relaxed font-sans font-light">
                Pre-warmed sandbox pools allow new fullstack applications (Node, Vite, Next.js, FastAPI) to boot in under 300ms, equipped with live terminal streams and intelligent file observers.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl transition-all duration-300 hover:border-amber-300/30 hover:bg-white/[0.06]">
              <div className="flex size-12 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/20 mb-6">
                <TerminalIcon className="size-6" />
              </div>
              <h3 className="font-serif text-2xl font-light text-white">
                Live Subdomain Preview Proxy
              </h3>
              <p className="mt-3 text-sm text-stone-300 leading-relaxed font-sans font-light">
                Instant reverse proxying dynamically listens to container ports 4000 and 3000, serving your running application on a dedicated SSL subdomain with live hot-reloading.
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="group rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl transition-all duration-300 hover:border-amber-300/30 hover:bg-white/[0.06]">
              <div className="flex size-12 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/20 mb-6">
                <GitBranchIcon className="size-6" />
              </div>
              <h3 className="font-serif text-2xl font-light text-white">
                Autonomous Git Checkpoints
              </h3>
              <p className="mt-3 text-sm text-stone-300 leading-relaxed font-sans font-light">
                Every multi-file step taken by Cloud Agent creates an atomic in-container git commit with human-readable semantic diffs, ready for one-click pull requests or rollback.
              </p>
            </div>
          </div>

          {/* Bottom Callout */}
          <div className="mt-16 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full border border-amber-200/50 bg-amber-300/10 px-8 py-3.5 text-xs font-sans font-medium tracking-[0.25em] text-white uppercase backdrop-blur-md transition-all duration-300 hover:border-amber-200 hover:bg-amber-300/20 hover:scale-105 shadow-[0_0_30px_rgba(255,220,130,0.2)]"
            >
              <SparklesIcon className="size-3.5 text-amber-300" />
              <span>Enter The Archive</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

export default LandingPage
