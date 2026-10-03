const FEATURES = [
  {
    num: "01",
    title: "ISOLATED CONTAINERS",
    description:
      "Every workspace provisions an isolated Docker container with root bash access, dedicated file systems, and instant ephemeral teardown.",
    tag: "SECURITY & REPRODUCIBILITY",
  },
  {
    num: "02",
    title: "DETERMINISTIC VERIFICATION",
    description:
      "Multi-turn agent loops autonomously run test suites, check lints, diagnose stack traces, and only commit when all criteria are satisfied.",
    tag: "ZERO REGRESSIONS",
  },
  {
    num: "03",
    title: "REAL-TIME TELEMETRY",
    description:
      "Full terminal output, AST transformations, and WebSocket token streaming delivered live with sub-millisecond local network latency.",
    tag: "COMPLETE OBSERVABILITY",
  },
]

export function SwissValueGrid() {
  return (
    <div className="bg-[var(--paper)] relative z-20">
      <div className="grid grid-cols-1 md:grid-cols-3 border-t-2 border-[var(--ink)]">
        {FEATURES.map((feat, idx) => (
          <div
            key={feat.num}
            className={`p-8 sm:p-12 ${
              idx < FEATURES.length - 1 ? "border-b md:border-b-0 md:border-r border-[var(--hairline)]" : ""
            }`}
          >
            <div className="mono text-[var(--red)] font-bold text-sm mb-4">
              {feat.num} // {feat.tag}
            </div>
            <h3 className="anton text-3xl sm:text-4xl mb-6 text-[var(--ink)] tracking-tight">
              {feat.title}
            </h3>
            <p className="archivo text-[var(--ink)] opacity-80 leading-relaxed text-sm sm:text-base">
              {feat.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
