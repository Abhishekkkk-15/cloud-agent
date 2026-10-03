import { Link } from "react-router-dom"

export function SwissFooter() {
  return (
    <footer className="bg-[var(--ink)] text-[var(--paper)] px-8 sm:px-16 py-20 sm:py-32 relative z-20">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 sm:gap-12 mb-20 sm:mb-28">
          <div className="flex flex-col gap-2.5">
            <div className="mono text-xs opacity-50 mb-3 tracking-[0.25em] text-[var(--red)]">
              LOCATIONS // CLUSTER
            </div>
            <span className="mono text-xs text-[var(--paper)]">US-EAST (VIRGINIA)</span>
            <span className="mono text-xs text-[var(--paper)]">EU-CENTRAL (FRANKFURT)</span>
            <span className="mono text-xs text-[var(--paper)]">AP-SOUTH (MUMBAI)</span>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="mono text-xs opacity-50 mb-3 tracking-[0.25em] text-[var(--red)]">
              PLATFORM
            </div>
            <Link to="/login" className="mono text-xs hover:text-[var(--red)] transition-colors">
              WORKSPACE APP
            </Link>
            <a href="#timeline" className="mono text-xs hover:text-[var(--red)] transition-colors">
              EXECUTION PIPELINE
            </a>
            <a href="#map" className="mono text-xs hover:text-[var(--red)] transition-colors">
              TOPOLOGY MESH
            </a>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="mono text-xs opacity-50 mb-3 tracking-[0.25em] text-[var(--red)]">
              LEGAL & AUDIT
            </div>
            <span className="mono text-xs opacity-75">PRIVACY SPECIFICATION</span>
            <span className="mono text-xs opacity-75">TERMS OF OPERATION</span>
            <span className="mono text-xs opacity-75">SOC2 COMPLIANCE READY</span>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="mono text-xs opacity-50 mb-3 tracking-[0.25em] text-[var(--red)]">
              COMMUNITY & CODE
            </div>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="mono text-xs hover:text-[var(--red)] transition-colors"
            >
              GITHUB REPOSITORY
            </a>
            <a
              href="https://x.com"
              target="_blank"
              rel="noreferrer"
              className="mono text-xs hover:text-[var(--red)] transition-colors"
            >
              X / TWITTER
            </a>
            <a
              href="https://discord.com"
              target="_blank"
              rel="noreferrer"
              className="mono text-xs hover:text-[var(--red)] transition-colors"
            >
              DISCORD COMMUNITY
            </a>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-t border-white/10 pt-10 gap-6">
          <div className="anton text-[14vw] sm:text-[12vw] leading-none tracking-tight text-[var(--paper)]">
            CLOUDAGENT
          </div>
          <div className="mono text-xs opacity-60 pb-2">
            © {new Date().getFullYear()} PRECISION AI ENGINEERING CORP
          </div>
        </div>
      </div>
    </footer>
  )
}
