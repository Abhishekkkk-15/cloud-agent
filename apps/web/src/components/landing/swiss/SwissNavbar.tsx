import { Link } from "react-router-dom"
import { BrandLogo } from "@/components/ui/BrandLogo"

export function SwissNavbar() {
  return (
    <nav className="fixed top-0 left-0 w-full z-50 px-8 py-4 flex justify-between items-center border-b border-[var(--hairline)] bg-[var(--paper)]/95 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <BrandLogo size={26} />
        <span className="mono">001 / SYSTEM ACTIVE</span>
      </div>

      <div className="mono font-bold tracking-widest hidden sm:block">
        CLOUD AGENT CORP
      </div>

      <div className="flex items-center gap-8">
        <a href="#wipe" className="mono hover:text-[var(--red)] transition-colors hidden md:inline-block">
          VELOCITY
        </a>
        <a href="#timeline" className="mono hover:text-[var(--red)] transition-colors hidden md:inline-block">
          EXECUTION
        </a>
        <a href="#map" className="mono hover:text-[var(--red)] transition-colors hidden md:inline-block">
          TOPOLOGY
        </a>
        <a href="#pricing" className="mono hover:text-[var(--red)] transition-colors hidden md:inline-block">
          RATES
        </a>
        <Link
          to="/login"
          className="mono text-xs px-4 py-2 border border-[var(--ink)] bg-[var(--ink)] text-white hover:bg-[var(--red)] hover:border-[var(--red)] transition-colors"
        >
          ENTER APP →
        </Link>
      </div>
    </nav>
  )
}
