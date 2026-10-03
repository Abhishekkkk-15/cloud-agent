export function SwissWipeSection() {
  return (
    <section className="stage-pin wipe" id="wipe">
      <div className="sticky-container bg-[var(--ink)] text-[var(--paper)]">
        <div className="px-8 max-w-5xl w-full">
          <div className="mono text-xs opacity-50 mb-4 tracking-[0.3em] text-[var(--red)]">
            PHILOSOPHY // ZERO TOLERANCE FOR FLUFF
          </div>

          <div className="relative py-12 sm:py-16">
            {/* Background faint text layer */}
            <div
              className="anton opacity-20 text-[7.4vw] leading-[0.9]"
              style={{ fontSize: "clamp(2.1rem, 7.4vw, 6.8rem)" }}
            >
              WE DO NOT WRITE SYNTHETIC SCRIPTS. WE MOVE REAL SOFTWARE INTO PRODUCTION.
            </div>

            {/* Scroll-clipped bright text layer */}
            <div
              className="anton absolute top-12 sm:top-16 left-0 text-[7.4vw] leading-[0.9] overflow-hidden whitespace-normal w-full"
              style={{
                fontSize: "clamp(2.1rem, 7.4vw, 6.8rem)",
                color: "var(--paper)",
                clipPath: "inset(0 calc(100% - var(--p2) * 100%) 0 0)",
              }}
            >
              WE DO NOT WRITE SYNTHETIC SCRIPTS. WE MOVE REAL SOFTWARE INTO PRODUCTION.
            </div>
          </div>

          <div className="h-[2px] bg-[var(--paper)] opacity-20 mb-10 w-full" />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 sm:gap-16">
            <div>
              <div className="mono opacity-60 mb-2">UPTIME & RELIABILITY</div>
              <div className="anton text-4xl sm:text-5xl text-[var(--paper)]">99.98%</div>
              <div className="mono text-[10px] text-[var(--red)] mt-1">DOCKER CONTAINER RESTARTS</div>
            </div>

            <div>
              <div className="mono opacity-60 mb-2">SPIN-UP LATENCY</div>
              <div className="anton text-4xl sm:text-5xl text-[var(--paper)]">0:03S</div>
              <div className="mono text-[10px] text-[var(--grey)] mt-1">SUB-SECOND ROOT TTY</div>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <div className="mono opacity-60 mb-2">DETERMINISTIC TESTS</div>
              <div className="anton text-4xl sm:text-5xl text-[var(--paper)]">100%</div>
              <div className="mono text-[10px] text-[var(--grey)] mt-1">PRE-MERGE PASS RATE</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
