import { useEffect, useState } from "react"
import { Link, Navigate, useLocation } from "react-router-dom"

import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { useAuthStore } from "@/stores/auth-store"

export function LoginPage() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const location = useLocation()
  const from =
    (location.state as { from?: string } | null)?.from ?? "/dashboard"

  // Live technical timestamp ticker
  const [timeStr, setTimeStr] = useState("")

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeStr(
        now.toTimeString().split(" ")[0] +
          "." +
          Math.floor(now.getMilliseconds() / 100)
      )
    }
    updateTime()
    const interval = setInterval(updateTime, 100)
    return () => clearInterval(interval)
  }, [])

  if (!loading && user) {
    return <Navigate to={from} replace />
  }

  return (
    <div className="swiss-container min-h-screen flex flex-col justify-between bg-[var(--paper)] text-[var(--ink)] selection:bg-[var(--red)] selection:text-white">
      {/* 44px geometric coordinate grid backdrop */}
      <div className="grid-bg fixed inset-0 pointer-events-none opacity-40" />

      {/* Top Header */}
      <header className="border-b border-[var(--hairline)] bg-[var(--paper)]/95 backdrop-blur-sm px-6 sm:px-12 py-4 flex justify-between items-center z-20 relative">
        <div className="flex items-center gap-3">
          <span className="inline-block w-2.5 h-2.5 bg-[var(--red)] animate-pulse" />
          <span className="mono text-xs font-bold tracking-widest">
            001 // AUTHENTICATION GATEWAY
          </span>
        </div>

        <div className="mono text-xs hidden md:block text-[var(--grey)] tracking-widest">
          CLOUD AGENT // SYSTEM TERMINAL
        </div>

        <div className="flex items-center gap-6">
          <ThemeSwitcher />
          <Link
            to="/"
            className="mono text-xs px-3 py-1.5 border border-[var(--ink)] hover:bg-[var(--ink)] hover:text-white transition-colors"
          >
            ← INDEX
          </Link>
        </div>
      </header>

      {/* Full-Bleed Architectural Broad-Sheet Grid (No Box / No Card) */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 relative z-10 w-full">
        {/* Left Column: Huge Editorial Display & Telemetry */}
        <div className="lg:col-span-7 flex flex-col justify-between p-8 sm:p-14 lg:p-20 border-b lg:border-b-0 lg:border-r border-[var(--hairline)] bg-[var(--paper-alt)]/40 relative">
          <div>
            <div className="mono text-xs text-[var(--red)] font-bold mb-4 tracking-[0.25em]">
              AUTHENTICATION PROTOCOL // MUTUAL TLS
            </div>

            <h1 className="anton text-5xl sm:text-7xl lg:text-8xl leading-[0.88] tracking-tight mb-8">
              INITIALIZE
              <br />
              DEVELOPER
              <br />
              <span style={{ color: "var(--red)" }}>SESSION.</span>
            </h1>

            <div className="h-[2px] bg-[var(--ink)] w-full mb-8 max-w-xl" />

            <p className="archivo text-base sm:text-lg max-w-lg text-[var(--ink)] opacity-80 leading-relaxed uppercase font-medium">
              Direct access to ephemeral Docker sandboxes, multi-agent synthesis
              engines, and live WebSocket telemetry streams.
            </p>
          </div>

          {/* Telemetry Ticker Ledger at the bottom of the left column */}
          <div className="mt-12 pt-8 border-t border-[var(--hairline)] grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <div className="mono text-[10px] text-[var(--grey)]">LOCAL CLOCK</div>
              <div className="mono text-sm font-bold text-[var(--red)] mt-0.5">
                {timeStr || "00:00:00.0"}
              </div>
            </div>
            <div>
              <div className="mono text-[10px] text-[var(--grey)]">TOPOLOGY</div>
              <div className="mono text-sm font-bold text-[var(--ink)] mt-0.5">
                SECTOR 04 / MESH
              </div>
            </div>
            <div>
              <div className="mono text-[10px] text-[var(--grey)]">
                SANDBOX ENCLAVE
              </div>
              <div className="mono text-sm font-bold text-[var(--ink)] mt-0.5">
                DOCKER ISOLATED
              </div>
            </div>
            <div>
              <div className="mono text-[10px] text-[var(--grey)]">LATENCY</div>
              <div className="mono text-sm font-bold text-[var(--red)] mt-0.5">
                &lt; 0.42S
              </div>
            </div>
          </div>

          {/* Animated red measurement line along the partition */}
          <div className="hr-red-anim" />
        </div>

        {/* Right Column: Architectural Typographic Sign-In Flow */}
        <div className="lg:col-span-5 flex flex-col justify-between p-8 sm:p-14 lg:p-20 bg-[var(--paper)]">
          <div className="flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--hairline)] pb-4 mb-10">
              <span className="mono text-xs text-[var(--grey)] tracking-widest">
                STAGE 01 // IDENTITY VALIDATION
              </span>
              <span className="mono text-[10px] px-2 py-0.5 bg-[var(--ink)] text-white">
                OAUTH 2.0
              </span>
            </div>

            <div className="mb-8">
              <h2 className="anton text-3xl sm:text-4xl text-[var(--ink)] mb-2">
                FEDERATED SINGLE SIGN-ON
              </h2>
              <p className="archivo text-xs sm:text-sm text-[var(--grey)]">
                Authenticate with your corporate or developer Google identity to
                provision compute resources.
              </p>
            </div>

            {/* Direct Google Sign-In Action (No Box / No Card) */}
            <div className="py-6 border-y border-[var(--ink)] my-2">
              <div className="flex flex-col items-start gap-4">
                <GoogleSignInButton redirectTo={from} />
                <span className="mono text-[10px] text-[var(--grey)]">
                  AUTOMATIC JWT ISSUANCE // ZERO-PERSISTENCE CREDENTIALS
                </span>
              </div>
            </div>

            {/* Specification Ledger List */}
            <div className="mt-8 space-y-4">
              <div className="mono text-xs text-[var(--red)] font-bold tracking-wider">
                SESSION ENTITLEMENTS:
              </div>
              <div className="divide-y divide-[var(--hairline)]">
                <div className="py-2.5 flex justify-between items-center text-xs">
                  <span className="mono font-semibold">ROOT PTY ACCESS</span>
                  <span className="mono text-[var(--grey)]">ENABLED</span>
                </div>
                <div className="py-2.5 flex justify-between items-center text-xs">
                  <span className="mono font-semibold">MULTI-FILE REFACTORING</span>
                  <span className="mono text-[var(--grey)]">AUTONOMOUS</span>
                </div>
                <div className="py-2.5 flex justify-between items-center text-xs">
                  <span className="mono font-semibold">CONTAINER RETENTION</span>
                  <span className="mono text-[var(--grey)]">EPHEMERAL / PERSISTED</span>
                </div>
                <div className="py-2.5 flex justify-between items-center text-xs">
                  <span className="mono font-semibold">COMMUNITY CREDITS</span>
                  <span className="mono text-[var(--red)] font-bold">
                    1,000,000 BYOK
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-[var(--hairline)]">
            <p className="mono text-[10px] text-[var(--grey)] leading-relaxed">
              BY CONNECTING, YOU AUTHORIZE CLOUD AGENT TO ALLOCATE REPRODUCIBLE
              CONTAINER INSTANCES IN ACCORDANCE WITH YOUR TEAM QUOTAS.
            </p>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="border-t border-[var(--hairline)] px-6 sm:px-12 py-4 flex flex-col sm:flex-row justify-between items-center gap-3 relative z-20 text-[var(--grey)] bg-[var(--paper)]">
        <div className="mono text-[11px] tracking-wider">
          SYSTEM STATUS // ALL ENDPOINTS OPERATIONAL [HTTP/3]
        </div>
        <div className="mono text-[11px] tracking-wider">
          © {new Date().getFullYear()} CLOUD AGENT CORP // SWISS MINIMALIST PRECISION
        </div>
      </footer>
    </div>
  )
}

export default LoginPage
