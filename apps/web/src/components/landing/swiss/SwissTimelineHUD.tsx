interface SwissTimelineHUDProps {
  p3: number
}

const TIMELINE_STEPS = [
  {
    time: "00:00",
    title: "SPECIFICATION INTAKE",
    subtitle: "ISSUE & PROMPT DECONSTRUCTION",
  },
  {
    time: "00:03",
    title: "CONTAINER PROVISIONING",
    subtitle: "ISOLATED DOCKER ENVIRONMENT UP",
  },
  {
    time: "01:15",
    title: "MULTI-FILE SYNTHESIS",
    subtitle: "AUTONOMOUS AST CODE REFACTORING",
  },
  {
    time: "02:30",
    title: "TEST SUITE VERIFICATION",
    subtitle: "IN-CONTAINER LINT & REGRESSION PASS",
  },
  {
    time: "03:00",
    title: "DEPLOYMENT READY",
    subtitle: "GIT COMMIT & VERIFIED PULL REQUEST",
  },
]

const STATUSES = ["IDLE", "PROVISIONING", "SYNTHESIZING", "TESTING", "DEPLOYED"]

export function SwissTimelineHUD({ p3 }: SwissTimelineHUDProps) {
  const totalSecs = Math.floor(p3 * 180)
  const mm = Math.floor(totalSecs / 60)
    .toString()
    .padStart(2, "0")
  const ss = (totalSecs % 60).toString().padStart(2, "0")

  const currentStage = Math.min(4, Math.floor(p3 * 5))
  const statusLabel = STATUSES[currentStage]
  const memoryBandwidth = (p3 * 4.82).toFixed(2)

  return (
    <section className="stage-pin timeline" id="timeline">
      <div className="sticky-container bg-[var(--paper-alt)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 w-full h-full">
          {/* Left Column: Timeline Run */}
          <div className="lg:col-span-7 flex flex-col justify-center px-8 sm:px-16 border-b lg:border-b-0 lg:border-r border-[var(--hairline)] py-12">
            <div className="mono text-xs text-[var(--red)] mb-3">
              EXECUTION LIFECYCLE // DETERMINISTIC PIPELINE
            </div>
            <h2 className="anton text-4xl sm:text-6xl lg:text-7xl mb-8 leading-none tracking-tight">
              THE ANATOMY OF A SINGLE AGENT RUN.
            </h2>

            <div className="space-y-4 sm:space-y-6 max-w-xl">
              {TIMELINE_STEPS.map((step, idx) => {
                const isActive = idx <= currentStage
                return (
                  <div
                    key={step.title}
                    className={`timeline-row py-3 sm:py-4 border-b border-[var(--hairline)] transition-opacity duration-300 ${
                      isActive ? "opacity-100" : "opacity-25"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="mono text-[var(--red)] font-bold">{step.time}</div>
                      <div className="mono text-[10px] text-[var(--grey)]">STAGE 0{idx + 1}</div>
                    </div>
                    <div className="anton text-2xl sm:text-3xl text-[var(--ink)] mt-1">
                      {step.title}
                    </div>
                    <div className="mono text-xs text-[var(--grey)] mt-0.5">
                      {step.subtitle}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Column: Square Precision Telemetry HUD */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-8 bg-[var(--paper)] lg:bg-transparent">
            <div className="w-full max-w-md aspect-square border-2 border-[var(--ink)] bg-[var(--paper)] relative flex flex-col p-6 sm:p-8 justify-between shadow-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <div className="mono text-xs font-bold">TASK #8841</div>
                  <div className="mono text-[10px] text-[var(--grey)]">DOCKER WORKSPACE NODE</div>
                </div>
                <div className="mono text-xs px-2.5 py-1 bg-[var(--ink)] text-white tracking-widest uppercase">
                  {statusLabel}
                </div>
              </div>

              <div className="my-auto py-4">
                <div className="mono text-xs text-[var(--grey)] mb-1">ELAPSED EXECUTION</div>
                <div className="anton text-6xl sm:text-8xl text-[var(--red)] leading-none tracking-tight">
                  {mm}:{ss}
                </div>
              </div>

              <div className="border-t border-[var(--hairline)] pt-4 flex justify-between items-center">
                <div>
                  <div className="mono text-[10px] text-[var(--grey)]">CODE COMMITTED</div>
                  <div className="mono text-sm sm:text-base font-bold text-[var(--ink)]">
                    {Math.round(p3 * 42)} FILES CHANGED
                  </div>
                </div>
                <div className="text-right">
                  <div className="mono text-[10px] text-[var(--grey)]">PAYLOAD STREAM</div>
                  <div className="mono text-sm sm:text-base font-bold text-[var(--red)]">
                    {memoryBandwidth} MB/S
                  </div>
                </div>
              </div>

              {/* Red bottom telemetry progress fill line */}
              <div
                className="absolute bottom-0 left-0 h-[6px] bg-[var(--red)] transition-all duration-75"
                style={{ width: `${Math.min(100, Math.max(0, p3 * 100))}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
