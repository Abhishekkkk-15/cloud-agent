import { Link } from "react-router-dom"

export function SwissHero() {
  return (
    <section className="stage-pin" id="hero">
      <div className="sticky-container">
        {/* 44px geometric coordinate grid background */}
        <div className="grid-bg absolute inset-0 pointer-events-none" />

        <div
          className="relative z-10 text-center max-w-6xl px-8 w-full"
          style={{
            transform: "translateY(calc(var(--p1) * -44px))",
            opacity: "calc(1 - var(--p1) * 1.5)",
          }}
        >
          <div className="mono mb-6 text-xs sm:text-sm tracking-[0.3em]">
            SYSTEM DIRECTIVE // TIME IS A GEOMETRIC CONSTANT
          </div>

          <h1
            className="anton leading-none mb-8 tracking-tight"
            id="hero-title"
            style={{
              fontSize: "min(clamp(56px, 15vw, 210px), calc(90vw / (10 * 0.44)))",
            }}
          >
            CLOUD<span style={{ color: "var(--red)" }}>AGENT</span>
          </h1>

          <div className="h-[2px] bg-[var(--ink)] mb-8 w-full" />

          <div className="flex flex-col md:flex-row gap-8 md:gap-12 text-left items-start md:items-end justify-between">
            <p className="max-w-xl text-lg sm:text-xl font-bold uppercase leading-relaxed text-[var(--ink)]">
              AUTONOMOUS AI SOFTWARE ENGINEERS RUNNING FULL-STACK CONTAINERIZED WORKSPACES WITH MATHEMATICAL PRECISION.
            </p>

            <div className="flex flex-col items-start md:items-end w-full md:w-auto">
              <Link
                to="/login"
                className="w-full sm:w-auto px-8 py-4 bg-[var(--red)] text-white anton text-2xl tracking-wide hover:bg-[var(--ink)] transition-colors shadow-lg text-center"
              >
                LAUNCH WORKSPACE
              </Link>
              <span className="mono text-[10px] text-[var(--grey)] mt-2">
                LATENCY &lt; 0.4S // DOCKER SANDBOX ISOLATION
              </span>
            </div>
          </div>
        </div>

        {/* Animated red baseline measurement bar */}
        <div className="hr-red-anim" />
      </div>
    </section>
  )
}
