import { useState, useEffect, useRef } from "react"
import { Link } from "react-router-dom"

export function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeProcessStep, setActiveProcessStep] = useState<number | null>(null)

  // Animated counters state
  const [counters, setCounters] = useState({
    autonomous: 0,
    spinUp: 3,
    config: 0,
  })
  const countersSectionRef = useRef<HTMLDivElement | null>(null)
  const countersTriggeredRef = useRef(false)

  // 1. Navbar scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // 2. Scroll Reveal Observer
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReducedMotion) return

    const elements = document.querySelectorAll(".reveal-on-scroll")
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const delay = parseInt(entry.target.getAttribute("data-delay") || "0", 10)
            setTimeout(() => {
              entry.target.classList.add("is-visible")
            }, delay)
            obs.unobserve(entry.target)
          }
        })
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -40px 0px",
      }
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  // 3. Counter Animation on Scroll
  useEffect(() => {
    const el = countersSectionRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries, obs) => {
        if (entries[0].isIntersecting && !countersTriggeredRef.current) {
          countersTriggeredRef.current = true
          obs.disconnect()

          const duration = 1200
          const startTime = performance.now()

          const updateCounter = (currentTime: number) => {
            const elapsed = currentTime - startTime
            const progress = Math.min(elapsed / duration, 1)
            const easeProgress = 1 - Math.pow(1 - progress, 4)

            setCounters({
              autonomous: Math.round(easeProgress * 100),
              spinUp: Math.max(1, Math.round((1 - easeProgress) * 3)),
              config: 0,
            })

            if (progress < 1) {
              requestAnimationFrame(updateCounter)
            } else {
              setCounters({ autonomous: 100, spinUp: 3, config: 0 })
            }
          }

          requestAnimationFrame(updateCounter)
        }
      },
      { threshold: 0.3 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileMenuOpen])

  return (
    <div className="bg-[#faf8f5] text-[#2d3a2e] font-sans antialiased selection:bg-[#3d5a3e]/20 min-h-screen overflow-x-hidden">
      {/* ======================================================== */}
      {/* NAVBAR                                                   */}
      {/* ======================================================== */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#faf8f5]/90 backdrop-blur-md shadow-sm"
            : "bg-transparent"
        }`}
        id="navbar"
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="relative flex items-center h-16 md:h-20">
            {/* Desktop left links */}
            <nav className="hidden md:flex items-center gap-8 animate-fade-down stagger-1">
              <a
                className="nav-link-indicator text-sm text-[#2d3a2e] tracking-wide uppercase hover:opacity-75 transition-opacity font-medium py-1"
                href="#overview"
              >
                Overview
              </a>
              <a
                className="nav-link-indicator text-sm text-[#2d3a2e] tracking-wide uppercase hover:opacity-75 transition-opacity font-medium py-1"
                href="#capabilities"
              >
                Capabilities
              </a>
              <a
                className="nav-link-indicator text-sm text-[#2d3a2e] tracking-wide uppercase hover:opacity-75 transition-opacity font-medium py-1"
                href="#architecture"
              >
                Architecture
              </a>
              <a
                className="nav-link-indicator text-sm text-[#2d3a2e] tracking-wide uppercase hover:opacity-75 transition-opacity font-medium py-1"
                href="#features"
              >
                Features
              </a>
            </nav>

            {/* Center logo (absolute centered) */}
            <Link
              to="/"
              aria-label="Palomar Home"
              className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5 animate-fade-down stagger-2 group"
            >
              <svg
                className="w-5 h-5 text-[#2d3a2e] fill-[#2d3a2e] group-hover:scale-110 transition-transform duration-300"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              </svg>
              <span className="text-xl text-[#2d3a2e] tracking-tight font-medium group-hover:tracking-normal transition-all duration-300">
                Palomar
              </span>
            </Link>

            {/* Desktop CTA (right) */}
            <div className="hidden md:inline-flex items-center ml-auto animate-fade-down stagger-3">
              <Link
                to="/login"
                className="btn-tactile px-5 py-2.5 bg-[#2d3a2e] text-white text-sm tracking-wide uppercase rounded-full hover:bg-[#3d5a3e] hover:shadow-btn-hover transition-all font-medium"
              >
                Try It Free
              </Link>
            </div>

            {/* Mobile hamburger button */}
            <button
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden ml-auto z-50 w-10 h-10 relative flex flex-col justify-center items-center focus:outline-none"
              type="button"
            >
              <span
                className={`w-6 h-[2px] bg-[#2d3a2e] rounded absolute transition-all duration-300 ease-[cubic-bezier(0.68,-0.6,0.32,1.6)] ${
                  mobileMenuOpen ? "top-[19px] rotate-45" : "top-[14px]"
                }`}
              />
              <span
                className={`w-6 h-[2px] bg-[#2d3a2e] rounded absolute transition-all duration-300 ease-[cubic-bezier(0.68,-0.6,0.32,1.6)] ${
                  mobileMenuOpen ? "top-[19px] -rotate-45" : "top-[22px]"
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* MOBILE OVERLAY                                           */}
      {/* ======================================================== */}
      <div
        className={`md:hidden fixed inset-0 bg-[#faf8f5] z-40 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className={`flex flex-col items-center justify-center h-full gap-8 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            mobileMenuOpen ? "translate-y-0 opacity-100" : "-translate-y-8 opacity-0"
          }`}
        >
          {["Overview", "Capabilities", "Architecture", "Features", "Use Cases"].map((item) => (
            <a
              key={item}
              onClick={() => setMobileMenuOpen(false)}
              className="text-3xl text-[#2d3a2e] tracking-tight font-medium hover:opacity-75 transition-opacity"
              href={`#${item.toLowerCase().replace(" ", "-")}`}
            >
              {item}
            </a>
          ))}
          <Link
            to="/login"
            onClick={() => setMobileMenuOpen(false)}
            className="mt-4 inline-flex items-center px-8 py-3.5 bg-[#2d3a2e] text-white text-lg tracking-wide rounded-full hover:bg-[#3d5a3e] transition-colors font-medium shadow-btn-hover"
          >
            Try It Free
          </Link>
        </div>
      </div>

      {/* ======================================================== */}
      {/* HERO SECTION                                            */}
      {/* ======================================================== */}
      <section className="relative w-full h-screen min-h-[700px] overflow-hidden bg-[#faf8f5]">
        {/* Video layer */}
        <div className="absolute inset-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover object-bottom"
            src="/hero-ambient.mp4"
            onError={(e) => {
              const target = e.currentTarget
              if (!target.src.includes("cloudfront.net")) {
                target.src =
                  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260820_010308_b1636845-4c15-4ab6-b0c9-9a29bfb0c6e3.mp4"
              }
            }}
          />
        </div>

        {/* Content column */}
        <div className="relative z-10 flex flex-col items-start max-w-7xl mx-auto pt-28 md:pt-36 px-6 lg:px-8">
          {/* Announcement pill with status indicator */}
          <Link
            to="/login"
            className="btn-tactile inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-[#2d3a2e]/15 bg-white/70 backdrop-blur-md hover:bg-white/90 hover:border-[#2d3a2e]/30 hover:shadow-pill-glow transition-all mb-5 md:mb-6 animate-fade-up stagger-3 group"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-beacon absolute inline-flex h-full w-full rounded-full bg-[#3d5a3e] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3d5a3e]" />
            </span>
            <span className="text-sm text-[#2d3a2e] font-normal">Live for everyone today! Offering $1MM in credits.</span>
            <svg
              className="w-3.5 h-3.5 text-[#2d3a2e] group-hover:translate-x-1 transition-transform duration-300"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>

          {/* Headline */}
          <h1 className="text-left text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-[#2d3a2e] leading-[1.05] tracking-tight max-w-4xl animate-fade-up stagger-4">
            One unified system to build,<br className="hidden sm:block" /> test, ship, and observe LLMs
          </h1>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 01 / OVERVIEW SECTION                                    */}
      {/* ======================================================== */}
      <section className="relative py-28 md:py-36 bg-[#faf8f5] border-t border-[#2d3a2e]/10" id="overview">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="reveal-on-scroll flex items-center gap-3 text-xs tracking-[0.25em] uppercase text-[#2d3a2e]/50 mb-8 font-medium">
            <span>01</span>
            <span className="reveal-line h-[1px] bg-[#2d3a2e]/30" />
            <span>Overview</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            <div className="lg:col-span-8 reveal-on-scroll" data-delay="100">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] font-normal leading-[1.2] text-[#2d3a2e] tracking-tight">
                Cloud Agent is an autonomous AI software engineer that turns natural language instructions into fully functioning, multi-file software applications inside secure, isolated cloud environments with real-time interactive previews.
              </h2>
            </div>
            <div className="lg:col-span-4 flex flex-col justify-between pt-2 reveal-on-scroll" data-delay="200">
              <p className="text-base sm:text-lg text-[#2d3a2e]/75 leading-relaxed font-light">
                Cloud Agent is an autonomous cloud-based coding platform. Instead of acting like a standard AI chatbot where you have to manually copy and paste code, Cloud Agent works like a full-time software engineer operating directly inside a dedicated cloud environment.
              </p>
              <div className="mt-8 pt-6 border-t border-[#2d3a2e]/15 text-sm text-[#2d3a2e]/65 font-light leading-relaxed">
                It understands the entire project structure, plans the implementation, writes and updates code across multiple files, installs packages, runs tests, and executes the application automatically.
              </div>
            </div>
          </div>

          {/* Quick Metrics Strip with Animated Counters */}
          <div ref={countersSectionRef} className="mt-20 pt-10 border-t border-[#2d3a2e]/10 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="reveal-on-scroll group cursor-default" data-delay="100">
              <div className="font-serif text-3xl md:text-4xl text-[#2d3a2e] group-hover:text-[#3d5a3e] transition-colors duration-300">
                <span>{counters.autonomous}%</span>
              </div>
              <div className="mt-2 text-xs uppercase tracking-[0.2em] text-[#2d3a2e]/60 font-medium">Autonomous Execution</div>
            </div>

            <div className="reveal-on-scroll group cursor-default" data-delay="200">
              <div className="font-serif text-3xl md:text-4xl text-[#2d3a2e] group-hover:text-[#3d5a3e] transition-colors duration-300">
                <span>&lt; {counters.spinUp}s</span>
              </div>
              <div className="mt-2 text-xs uppercase tracking-[0.2em] text-[#2d3a2e]/60 font-medium">Cloud Sandbox Spin-Up</div>
            </div>

            <div className="reveal-on-scroll group cursor-default" data-delay="300">
              <div className="font-serif text-3xl md:text-4xl text-[#2d3a2e] group-hover:text-[#3d5a3e] transition-colors duration-300">
                Multi-file
              </div>
              <div className="mt-2 text-xs uppercase tracking-[0.2em] text-[#2d3a2e]/60 font-medium">Context Awareness</div>
            </div>

            <div className="reveal-on-scroll group cursor-default" data-delay="400">
              <div className="font-serif text-3xl md:text-4xl text-[#2d3a2e] group-hover:text-[#3d5a3e] transition-colors duration-300">
                <span>0 Config</span>
              </div>
              <div className="mt-2 text-xs uppercase tracking-[0.2em] text-[#2d3a2e]/60 font-medium">Instant Previews</div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 02 / CAPABILITIES SECTION                                */}
      {/* ======================================================== */}
      <section className="py-28 md:py-36 bg-[#f5f3ef] border-t border-[#2d3a2e]/10" id="capabilities">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 pb-8 border-b border-[#2d3a2e]/10 gap-6 reveal-on-scroll">
            <div>
              <div className="flex items-center gap-3 text-xs tracking-[0.25em] uppercase text-[#2d3a2e]/50 mb-4 font-medium">
                <span>02</span>
                <span className="reveal-line h-[1px] bg-[#2d3a2e]/30" />
                <span>Capabilities</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl text-[#2d3a2e] tracking-tight">
                Engineered to deliver end-to-end software
              </h2>
            </div>
            <p className="text-sm md:text-base text-[#2d3a2e]/70 max-w-md font-light leading-relaxed">
              From conversational intent to self-healing deployments. An uninterrupted pipeline replacing fractured toolchains.
            </p>
          </div>

          {/* 6 Core Capabilities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div
              className="reveal-on-scroll p-8 rounded-2xl bg-[#faf8f5]/80 border border-[#2d3a2e]/10 flex flex-col justify-between hover-card-elevated hover:shadow-card-lift hover:border-[#2d3a2e]/25 group cursor-pointer"
              data-delay="50"
            >
              <div>
                <div className="w-10 h-10 rounded-full bg-[#2d3a2e]/5 border border-[#2d3a2e]/10 flex items-center justify-center text-[#2d3a2e] mb-6 group-hover:bg-[#3d5a3e] group-hover:text-white transition-colors duration-300">
                  <svg className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="m18 16 4-4-4-4" />
                    <path d="m6 8-4 4 4 4" />
                    <path d="m14.5 4-5 16" />
                  </svg>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-[#2d3a2e]/40 block mb-2 font-mono">01 / Synthesis</span>
                <h3 className="text-xl text-[#2d3a2e] tracking-tight font-medium mb-3 group-hover:text-[#3d5a3e] transition-colors">
                  Translates Ideas into Working Software
                </h3>
                <p className="text-sm text-[#2d3a2e]/75 leading-relaxed font-light">
                  Describe the application or feature you want in plain words; the agent plans the project architecture and writes production-ready code with exact precision.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-[#2d3a2e]/10 text-xs text-[#3d5a3e] font-medium tracking-wide flex items-center gap-1.5">
                <span>Natural language to full codebases</span>
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">→</span>
              </div>
            </div>

            {/* Card 2 */}
            <div
              className="reveal-on-scroll p-8 rounded-2xl bg-[#faf8f5]/80 border border-[#2d3a2e]/10 flex flex-col justify-between hover-card-elevated hover:shadow-card-lift hover:border-[#2d3a2e]/25 group cursor-pointer"
              data-delay="150"
            >
              <div>
                <div className="w-10 h-10 rounded-full bg-[#2d3a2e]/5 border border-[#2d3a2e]/10 flex items-center justify-center text-[#2d3a2e] mb-6 group-hover:bg-[#3d5a3e] group-hover:text-white transition-colors duration-300">
                  <svg className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                    <path d="M8 13h4" />
                    <path d="M10 11v4" />
                  </svg>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-[#2d3a2e]/40 block mb-2 font-mono">02 / Refactoring</span>
                <h3 className="text-xl text-[#2d3a2e] tracking-tight font-medium mb-3 group-hover:text-[#3d5a3e] transition-colors">
                  Autonomous Multi-File Editing
                </h3>
                <p className="text-sm text-[#2d3a2e]/75 leading-relaxed font-light">
                  Navigates complex codebases, creating new files and making surgical modifications across directories without breaking dependencies or imports.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-[#2d3a2e]/10 text-xs text-[#3d5a3e] font-medium tracking-wide flex items-center gap-1.5">
                <span>Whole-repository context tree</span>
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">→</span>
              </div>
            </div>

            {/* Card 3 */}
            <div
              className="reveal-on-scroll p-8 rounded-2xl bg-[#faf8f5]/80 border border-[#2d3a2e]/10 flex flex-col justify-between hover-card-elevated hover:shadow-card-lift hover:border-[#2d3a2e]/25 group cursor-pointer"
              data-delay="250"
            >
              <div>
                <div className="w-10 h-10 rounded-full bg-[#2d3a2e]/5 border border-[#2d3a2e]/10 flex items-center justify-center text-[#2d3a2e] mb-6 group-hover:bg-[#3d5a3e] group-hover:text-white transition-colors duration-300">
                  <svg className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                    <rect height="18" rx="2" width="18" x="3" y="3" />
                    <path d="m9 8 6 4-6 4Z" />
                  </svg>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-[#2d3a2e]/40 block mb-2 font-mono">03 / Lifecycle</span>
                <h3 className="text-xl text-[#2d3a2e] tracking-tight font-medium mb-3 group-hover:text-[#3d5a3e] transition-colors">
                  Executes and Runs Applications
                </h3>
                <p className="text-sm text-[#2d3a2e]/75 leading-relaxed font-light">
                  Handles the runtime lifecycle—installing dependencies via npm or pip, starting local dev servers, and managing build processes autonomously.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-[#2d3a2e]/10 text-xs text-[#3d5a3e] font-medium tracking-wide flex items-center gap-1.5">
                <span>Automated runtime orchestration</span>
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">→</span>
              </div>
            </div>

            {/* Card 4 */}
            <div
              className="reveal-on-scroll p-8 rounded-2xl bg-[#faf8f5]/80 border border-[#2d3a2e]/10 flex flex-col justify-between hover-card-elevated hover:shadow-card-lift hover:border-[#2d3a2e]/25 group cursor-pointer"
              data-delay="100"
            >
              <div>
                <div className="w-10 h-10 rounded-full bg-[#2d3a2e]/5 border border-[#2d3a2e]/10 flex items-center justify-center text-[#2d3a2e] mb-6 group-hover:bg-[#3d5a3e] group-hover:text-white transition-colors duration-300">
                  <svg className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                    <path d="M2 12h20" />
                  </svg>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-[#2d3a2e]/40 block mb-2 font-mono">04 / Preview</span>
                <h3 className="text-xl text-[#2d3a2e] tracking-tight font-medium mb-3 group-hover:text-[#3d5a3e] transition-colors">
                  Instant Live Application Previews
                </h3>
                <p className="text-sm text-[#2d3a2e]/75 leading-relaxed font-light">
                  Serves a live, working version of the app immediately so you can click, test, input state, and validate features in real time without leaving the tab.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-[#2d3a2e]/10 text-xs text-[#3d5a3e] font-medium tracking-wide flex items-center gap-1.5">
                <span>Interactive hot-reloading browser</span>
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">→</span>
              </div>
            </div>

            {/* Card 5 */}
            <div
              className="reveal-on-scroll p-8 rounded-2xl bg-[#faf8f5]/80 border border-[#2d3a2e]/10 flex flex-col justify-between hover-card-elevated hover:shadow-card-lift hover:border-[#2d3a2e]/25 group cursor-pointer"
              data-delay="200"
            >
              <div>
                <div className="w-10 h-10 rounded-full bg-[#2d3a2e]/5 border border-[#2d3a2e]/10 flex items-center justify-center text-[#2d3a2e] mb-6 group-hover:bg-[#3d5a3e] group-hover:text-white transition-colors duration-300">
                  <svg className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" x2="12" y1="9" y2="13" />
                    <line x1="12" x2="12.01" y1="17" y2="17" />
                  </svg>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-[#2d3a2e]/40 block mb-2 font-mono">05 / Resilience</span>
                <h3 className="text-xl text-[#2d3a2e] tracking-tight font-medium mb-3 group-hover:text-[#3d5a3e] transition-colors">
                  Self-Healing and Debugging
                </h3>
                <p className="text-sm text-[#2d3a2e]/75 leading-relaxed font-light">
                  Reads terminal error logs and stack traces, investigates underlying bugs, and automatically applies patches until the application runs cleanly.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-[#2d3a2e]/10 text-xs text-[#3d5a3e] font-medium tracking-wide flex items-center gap-1.5">
                <span>Autonomous terminal diagnostic loop</span>
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">→</span>
              </div>
            </div>

            {/* Card 6 */}
            <div
              className="reveal-on-scroll p-8 rounded-2xl bg-[#faf8f5]/80 border border-[#2d3a2e]/10 flex flex-col justify-between hover-card-elevated hover:shadow-card-lift hover:border-[#2d3a2e]/25 group cursor-pointer"
              data-delay="300"
            >
              <div>
                <div className="w-10 h-10 rounded-full bg-[#2d3a2e]/5 border border-[#2d3a2e]/10 flex items-center justify-center text-[#2d3a2e] mb-6 group-hover:bg-[#3d5a3e] group-hover:text-white transition-colors duration-300">
                  <svg className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                    <path d="M9 18c-4.51 2-5-2-7-2" />
                  </svg>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-[#2d3a2e]/40 block mb-2 font-mono">06 / Versioning</span>
                <h3 className="text-xl text-[#2d3a2e] tracking-tight font-medium mb-3 group-hover:text-[#3d5a3e] transition-colors">
                  Direct GitHub Integration
                </h3>
                <p className="text-sm text-[#2d3a2e]/75 leading-relaxed font-light">
                  Automatically tracks changes with Git, writes meaningful commit messages, and pushes code to your GitHub repositories or creates ready-to-merge pull requests.
                </p>
              </div>
              <div className="mt-8 pt-4 border-t border-[#2d3a2e]/10 text-xs text-[#3d5a3e] font-medium tracking-wide flex items-center gap-1.5">
                <span>One-click pull requests &amp; branches</span>
                <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">→</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 03 / ARCHITECTURE & PROCESS SECTION                      */}
      {/* ======================================================== */}
      <section className="py-28 md:py-36 bg-[#faf8f5] border-t border-[#2d3a2e]/10" id="architecture">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-3xl mb-20 reveal-on-scroll">
            <div className="flex items-center gap-3 text-xs tracking-[0.25em] uppercase text-[#2d3a2e]/50 mb-4 font-medium">
              <span>03</span>
              <span className="reveal-line h-[1px] bg-[#2d3a2e]/30" />
              <span>Architecture &amp; Process</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl text-[#2d3a2e] tracking-tight">
              How Cloud Agent operates
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#2d3a2e]/70 font-light leading-relaxed">
              A deterministic, 5-phase execution loop that mirrors a senior software engineer from ticket intake to release.
            </p>
          </div>

          {/* 5-Step Process Timeline */}
          <div className="space-y-6 md:space-y-0 md:grid md:grid-cols-5 md:gap-6 relative">
            {[
              {
                num: "01",
                title: "Project Initiation",
                desc: "Start from scratch with a prompt, pick popular templates (React, Next.js, Python API), or import existing GitHub repositories.",
                sub: "Source & Scaffolding",
              },
              {
                num: "02",
                title: "Planning & Reasoning",
                desc: "Analyzes requests, breaks down tasks into logical steps, inspects existing files, and formulates step-by-step execution plans.",
                sub: "Graph Traversal",
              },
              {
                num: "03",
                title: "Secure Sandboxing",
                desc: "Dedicated, isolated cloud containers. All file modifications, commands, and servers run within secure boundaries safely.",
                sub: "Isolated MicroVM",
              },
              {
                num: "04",
                title: "Live Verification",
                desc: "Dynamic proxy serves the application live for instant interactive validation, error telemetry, and functional inspection.",
                sub: "Hot Web Proxy",
              },
              {
                num: "05",
                title: "Version & Publish",
                desc: "Clean, reversible checkpoints with atomic Git commits, direct repository sync, and seamless pull request creation.",
                sub: "Git Checkpoint",
              },
            ].map((step, idx) => (
              <div
                key={step.num}
                onMouseEnter={() => setActiveProcessStep(idx)}
                onMouseLeave={() => setActiveProcessStep(null)}
                className={`process-card reveal-on-scroll relative p-6 rounded-2xl bg-[#f5f3ef]/60 border border-[#2d3a2e]/10 flex flex-col justify-between group cursor-pointer ${
                  activeProcessStep === idx ? "step-active" : ""
                }`}
                data-delay={`${50 + idx * 70}`}
              >
                <div>
                  <div className="step-num text-2xl font-serif italic text-[#2d3a2e]/40 mb-4 transition-colors duration-300">
                    {step.num}
                  </div>
                  <h3 className="text-lg text-[#2d3a2e] tracking-tight font-medium mb-2 group-hover:text-[#3d5a3e] transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#2d3a2e]/75 font-light leading-relaxed">
                    {step.desc}
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-[#2d3a2e]/10 text-[11px] font-mono uppercase tracking-wider text-[#2d3a2e]/50 flex items-center justify-between">
                  <span>{step.sub}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3d5a3e]/30 group-hover:bg-[#3d5a3e] transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 04 / KEY FEATURES & PLATFORM PILLARS                     */}
      {/* ======================================================== */}
      <section className="py-28 md:py-36 bg-[#f5f3ef] border-t border-[#2d3a2e]/10" id="features">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="reveal-on-scroll flex items-center gap-3 text-xs tracking-[0.25em] uppercase text-[#2d3a2e]/50 mb-4 font-medium">
            <span>04</span>
            <span className="reveal-line h-[1px] bg-[#2d3a2e]/30" />
            <span>Key Features</span>
          </div>
          <h2 className="reveal-on-scroll text-3xl sm:text-4xl md:text-5xl text-[#2d3a2e] tracking-tight mb-16" data-delay="100">
            Built for production-grade velocity
          </h2>

          {/* Feature Matrix Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                id: "01",
                title: "Natural Language to Full-Stack App",
                desc: "Generates frontend interfaces, backend APIs, data models, and business logic from simple prompts without requiring initial boilerplate.",
              },
              {
                id: "02",
                title: "Context-Aware Code Modifications",
                desc: "Understands the entire codebase so changes in one file (e.g., modifying an API endpoint signature) automatically update all dependent caller files.",
              },
              {
                id: "03",
                title: "Automated Package & Dependency Management",
                desc: "Automatically detects missing libraries, installs required npm or pip packages, and synchronizes manifest and lock files cleanly.",
              },
              {
                id: "04",
                title: "Autonomous Error Recovery",
                desc: "Watches terminal output and server logs to catch compilation or runtime bugs, formulating counter-measures and self-repairing until fully functional.",
              },
              {
                id: "05",
                title: "Zero-Setup Cloud Sandboxes",
                desc: "Instant development environments spin up in seconds with zero need to install Node.js, Python, package managers, or Docker locally.",
              },
              {
                id: "06",
                title: "Automatic Git History & GitHub Sync",
                desc: "Automatic branching, staging, atomic commits, and one-click GitHub push/PR creation so team collaboration remains seamless and traceable.",
              },
            ].map((feat, idx) => (
              <div
                key={feat.id}
                className="reveal-on-scroll p-8 rounded-2xl bg-[#faf8f5] border border-[#2d3a2e]/10 hover-card-elevated hover:shadow-card-lift hover:border-[#2d3a2e]/25 group cursor-default"
                data-delay={`${50 + (idx % 3) * 100}`}
              >
                <div className="font-mono text-xs text-[#3d5a3e] uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Feature {feat.id}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#3d5a3e]/40 group-hover:scale-125 transition-transform" />
                </div>
                <h3 className="text-lg font-medium text-[#2d3a2e] mb-2 group-hover:text-[#3d5a3e] transition-colors">
                  {feat.title}
                </h3>
                <p className="text-sm text-[#2d3a2e]/75 font-light leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 05 / TARGET USERS & USE CASES                            */}
      {/* ======================================================== */}
      <section className="py-28 md:py-36 bg-[#faf8f5] border-t border-[#2d3a2e]/10" id="use-cases">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mb-16 reveal-on-scroll">
            <div className="flex items-center gap-3 text-xs tracking-[0.25em] uppercase text-[#2d3a2e]/50 mb-4 font-medium">
              <span>05</span>
              <span className="reveal-line h-[1px] bg-[#2d3a2e]/30" />
              <span>Audience &amp; Use Cases</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl text-[#2d3a2e] tracking-tight">
              Who builds with Cloud Agent
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Persona 1 */}
            <div
              className="reveal-on-scroll p-8 lg:p-10 rounded-3xl bg-[#f5f3ef]/70 border border-[#2d3a2e]/10 flex flex-col justify-between hover-card-elevated hover:bg-[#f5f3ef] hover:shadow-card-lift hover:border-[#2d3a2e]/25 group cursor-pointer"
              data-delay="50"
            >
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[#2d3a2e]/50 font-mono mb-4">Founders &amp; PMs</div>
                <h3 className="text-2xl text-[#2d3a2e] tracking-tight font-medium mb-4 group-hover:text-[#3d5a3e] transition-colors">
                  Product Managers &amp; Founders
                </h3>
                <p className="text-base text-[#2d3a2e]/75 font-light leading-relaxed">
                  Quickly build proof-of-concepts, interactive prototypes, and production-ready MVPs without needing dedicated engineering teams or waiting on multi-week development sprints for initial drafts.
                </p>
              </div>
              <div className="mt-10 pt-6 border-t border-[#2d3a2e]/10 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-[#2d3a2e]/60 font-medium">Concept to demo</span>
                <span className="text-[#3d5a3e] font-mono text-sm group-hover:translate-x-1 transition-transform">→ Hours</span>
              </div>
            </div>

            {/* Persona 2 */}
            <div
              className="reveal-on-scroll p-8 lg:p-10 rounded-3xl bg-[#f5f3ef]/70 border border-[#2d3a2e]/10 flex flex-col justify-between hover-card-elevated hover:bg-[#f5f3ef] hover:shadow-card-lift hover:border-[#2d3a2e]/25 group cursor-pointer"
              data-delay="150"
            >
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[#2d3a2e]/50 font-mono mb-4">Engineering Teams</div>
                <h3 className="text-2xl text-[#2d3a2e] tracking-tight font-medium mb-4 group-hover:text-[#3d5a3e] transition-colors">
                  Software Engineers
                </h3>
                <p className="text-base text-[#2d3a2e]/75 font-light leading-relaxed">
                  Delegate tedious setup, boilerplate plumbing, test generation, bug fixing, and wide multi-file refactors to an autonomous agent that respects repository patterns and produces clean git histories.
                </p>
              </div>
              <div className="mt-10 pt-6 border-t border-[#2d3a2e]/10 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-[#2d3a2e]/60 font-medium">Boilerplate eliminated</span>
                <span className="text-[#3d5a3e] font-mono text-sm group-hover:translate-x-1 transition-transform">→ 10x Velocity</span>
              </div>
            </div>

            {/* Persona 3 */}
            <div
              className="reveal-on-scroll p-8 lg:p-10 rounded-3xl bg-[#f5f3ef]/70 border border-[#2d3a2e]/10 flex flex-col justify-between hover-card-elevated hover:bg-[#f5f3ef] hover:shadow-card-lift hover:border-[#2d3a2e]/25 group cursor-pointer"
              data-delay="250"
            >
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[#2d3a2e]/50 font-mono mb-4">Creative Technologists</div>
                <h3 className="text-2xl text-[#2d3a2e] tracking-tight font-medium mb-4 group-hover:text-[#3d5a3e] transition-colors">
                  Designers &amp; Creators
                </h3>
                <p className="text-base text-[#2d3a2e]/75 font-light leading-relaxed">
                  Bring design mockups and application concepts to life with real, interactive, deployable code using plain language—bypassing static prototypes to test real state, interactions, and APIs.
                </p>
              </div>
              <div className="mt-10 pt-6 border-t border-[#2d3a2e]/10 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-[#2d3a2e]/60 font-medium">Figma to full-stack</span>
                <span className="text-[#3d5a3e] font-mono text-sm group-hover:translate-x-1 transition-transform">→ Real Code</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 06 / CTA SECTION                                         */}
      {/* ======================================================== */}
      <section className="py-24 md:py-32 bg-[#2d3a2e] text-white relative overflow-hidden" id="try">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center relative z-10 reveal-on-scroll">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm text-xs text-white/80 tracking-widest uppercase font-mono mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3d5a3e] animate-beacon" />
            <span>Autonomous Software Engineer</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white tracking-tight max-w-3xl mx-auto leading-tight">
            Start building with Cloud Agent today
          </h2>

          <p className="mt-6 text-base sm:text-lg text-white/70 max-w-xl mx-auto font-light leading-relaxed">
            Turn natural language into production code inside secure, isolated sandboxes. Get started instantly with $1MM in community credits.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="btn-tactile w-full sm:w-auto px-8 py-3.5 bg-[#faf8f5] text-[#2d3a2e] text-sm tracking-wide uppercase rounded-full hover:bg-white hover:shadow-btn-hover transition-all font-medium"
            >
              Try It Free
            </Link>
            <a
              href="#overview"
              className="btn-tactile w-full sm:w-auto px-8 py-3.5 bg-white/10 text-white text-sm tracking-wide uppercase rounded-full hover:bg-white/20 transition-all font-medium border border-white/15"
            >
              Read Documentation
            </a>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* FOOTER                                                   */}
      {/* ======================================================== */}
      <footer className="bg-[#faf8f5] border-t border-[#2d3a2e]/10 py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-12 border-b border-[#2d3a2e]/10">
            {/* Brand Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <svg
                className="w-5 h-5 text-[#2d3a2e] fill-[#2d3a2e] group-hover:scale-110 transition-transform duration-300"
                stroke="currentColor"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              </svg>
              <span className="text-xl text-[#2d3a2e] tracking-tight font-medium group-hover:opacity-80 transition-opacity">
                Palomar
              </span>
            </Link>

            {/* Links */}
            <div className="flex flex-wrap gap-8 text-sm text-[#2d3a2e]/70 font-light">
              <a className="hover:text-[#2d3a2e] transition-colors duration-200" href="#overview">
                Overview
              </a>
              <a className="hover:text-[#2d3a2e] transition-colors duration-200" href="#capabilities">
                Capabilities
              </a>
              <a className="hover:text-[#2d3a2e] transition-colors duration-200" href="#architecture">
                Architecture
              </a>
              <a className="hover:text-[#2d3a2e] transition-colors duration-200" href="#features">
                Features
              </a>
              <a className="hover:text-[#2d3a2e] transition-colors duration-200" href="#use-cases">
                Use Cases
              </a>
              <a className="hover:text-[#2d3a2e] transition-colors duration-200" href="#try">
                Privacy
              </a>
              <a className="hover:text-[#2d3a2e] transition-colors duration-200" href="#try">
                Security
              </a>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#2d3a2e]/50 gap-4">
            <div>
              © {new Date().getFullYear()} Palomar Inc. All rights reserved.
            </div>
            <div className="flex items-center gap-6">
              <span className="hover:text-[#2d3a2e] transition-colors cursor-pointer">Terms of Service</span>
              <span className="hover:text-[#2d3a2e] transition-colors cursor-pointer">Security Whitepaper</span>
              <span className="hover:text-[#2d3a2e] transition-colors cursor-pointer">System Status</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
