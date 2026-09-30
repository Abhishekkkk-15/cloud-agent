import { ShieldCheckIcon, GitBranchIcon, GlobeIcon, ZapIcon } from "lucide-react"

const METRICS = [
  {
    icon: ShieldCheckIcon,
    value: "100%",
    label: "Container-Native Isolation",
    desc: "Named Docker volumes prevent untrusted project code from ever touching host disk.",
    color: "text-emerald-400",
  },
  {
    icon: ZapIcon,
    value: "< 1.8s",
    label: "Sandbox Spinup",
    desc: "Instant container boot with pre-warmed dev environments and port forwarding.",
    color: "text-amber-400",
  },
  {
    icon: GlobeIcon,
    value: "0.0.0.0",
    label: "Live Preview Proxy",
    desc: "Fullstack frontend (4000) and backend (3000) proxy with custom subdomains.",
    color: "text-sky-400",
  },
  {
    icon: GitBranchIcon,
    value: "Native Git",
    label: "Autonomous Versioning",
    desc: "Automated git checkpointing, diff summarization, and direct GitHub pull requests.",
    color: "text-purple-400",
  },
]

export function HeroMetrics() {
  return (
    <div className="relative mx-auto mt-16 w-full max-w-5xl px-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map((item, idx) => {
          const Icon = item.icon
          return (
            <div
              key={idx}
              className="group relative flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/60 p-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:border-primary/40 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="flex items-center justify-between">
                <div className={`flex size-9 items-center justify-center rounded-xl bg-muted/60 ${item.color}`}>
                  <Icon className="size-5" />
                </div>
                <span className="font-mono text-xl font-bold tracking-tight text-foreground">
                  {item.value}
                </span>
              </div>
              <h3 className="font-medium text-sm text-foreground pt-1">{item.label}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
