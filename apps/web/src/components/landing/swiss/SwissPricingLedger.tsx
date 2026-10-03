import { Link } from "react-router-dom"

const TIERS = [
  {
    name: "DEVELOPER SANDBOX",
    specs: "1 CONCURRENT CONTAINER // 2 CPU // 4GB RAM // BYOK / FREE TIER",
    price: "$0.00",
    period: "FOREVER",
  },
  {
    name: "PRO ENGINEER CLUSTER",
    specs: "5 PARALLEL AGENT NODES // DEDICATED DEV MACHINES // UNLIMITED BUILDS",
    price: "$29.00",
    period: "PER MONTH",
    featured: true,
  },
  {
    name: "ENTERPRISE CLUSTER",
    specs: "UNLIMITED CONTAINER TOPOLOGY // CUSTOM VPC // HIGH-AVAILABILITY SLA",
    price: "CUSTOM",
    period: "ANNUAL CONTRACT",
  },
]

export function SwissPricingLedger() {
  return (
    <section id="pricing" className="bg-[var(--paper)] relative z-20 px-8 sm:px-16 py-20 sm:py-32">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b-2 border-[var(--ink)] pb-4 mb-8">
          <h3 className="anton text-4xl sm:text-6xl text-[var(--ink)] tracking-tight">
            PRICING TIERS
          </h3>
          <span className="mono text-xs text-[var(--grey)] mt-2 sm:mt-0">
            TRANSPARENT SPECIFICATION LEDGER
          </span>
        </div>

        <div className="divide-y divide-[var(--hairline)]">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className="flex flex-col sm:flex-row justify-between sm:items-center py-6 sm:py-8 gap-4 hover:bg-[var(--paper-alt)]/50 px-4 transition-colors"
            >
              <div className="flex flex-col">
                <span className="anton text-2xl sm:text-3xl text-[var(--ink)] flex items-center gap-3">
                  {tier.name}
                  {tier.featured && (
                    <span className="mono text-[10px] px-2 py-0.5 bg-[var(--red)] text-white">
                      RECOMMENDED
                    </span>
                  )}
                </span>
                <span className="mono text-xs text-[var(--grey)] mt-1">
                  {tier.specs}
                </span>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-6">
                <div className="text-right">
                  <div className="anton text-3xl sm:text-4xl text-[var(--red)]">
                    {tier.price}
                  </div>
                  <div className="mono text-[10px] text-[var(--grey)]">
                    {tier.period}
                  </div>
                </div>

                <Link
                  to="/login"
                  className="mono text-xs px-4 py-2 border border-[var(--ink)] hover:bg-[var(--ink)] hover:text-white transition-colors"
                >
                  SELECT →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
