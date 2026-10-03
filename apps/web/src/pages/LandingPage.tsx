import { useSwissScrollProgress } from "@/hooks/useSwissScrollProgress"
import { SwissNavbar } from "@/components/landing/swiss/SwissNavbar"
import { SwissHero } from "@/components/landing/swiss/SwissHero"
import { SwissWipeSection } from "@/components/landing/swiss/SwissWipeSection"
import { SwissTimelineHUD } from "@/components/landing/swiss/SwissTimelineHUD"
import { SwissMapCanvas } from "@/components/landing/swiss/SwissMapCanvas"
import { SwissValueGrid } from "@/components/landing/swiss/SwissValueGrid"
import { SwissPricingLedger } from "@/components/landing/swiss/SwissPricingLedger"
import { SwissFooter } from "@/components/landing/swiss/SwissFooter"

export function LandingPage() {
  const { p3, p4 } = useSwissScrollProgress()

  return (
    <div className="swiss-container min-h-screen selection:bg-[var(--red)] selection:text-white">
      {/* 1. Fixed Precision Navbar */}
      <SwissNavbar />

      <main className="relative">
        {/* 2. Hero Stage (Stage-Pin 1) */}
        <SwissHero />

        {/* 3. Dark Inverted Wipe Stage (Stage-Pin 2) */}
        <SwissWipeSection />

        {/* 4. Anatomy of Execution Timeline & Telemetry HUD (Stage-Pin 3) */}
        <SwissTimelineHUD p3={p3} />

        {/* 5. Interactive HTML5 Canvas Network Topology Map (Stage-Pin 4) */}
        <SwissMapCanvas p4={p4} />

        {/* 6. Brutalist 3-Column Value Features */}
        <SwissValueGrid />

        {/* 7. Pricing Models & Rate Ledger */}
        <SwissPricingLedger />
      </main>

      {/* 8. Full Inverted Footer with 12vw Mega-Brandmark */}
      <SwissFooter />
    </div>
  )
}

export default LandingPage
