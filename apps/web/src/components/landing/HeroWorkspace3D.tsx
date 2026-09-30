import { useState, useRef, type MouseEvent } from "react"
import {
  TerminalIcon,
  GlobeIcon,
  CheckCircle2Icon,
  GitBranchIcon,
  BoxIcon,
  SparklesIcon,
  FolderTreeIcon,
  FileCode2Icon,
  RefreshCwIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface HeroWorkspace3DProps {
  activePreset?: string
}

export function HeroWorkspace3D({ activePreset = "kanban" }: HeroWorkspace3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [rotate, setRotate] = useState({ x: 12, y: -16 })
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 })
  const [activeTab, setActiveTab] = useState<"App.tsx" | "server.ts" | "Dockerfile">("App.tsx")
  const [counter, setCounter] = useState(42)

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2

    // Max rotation +/- 16 deg
    const rotX = -((y - centerY) / centerY) * 14 + 10
    const rotY = ((x - centerX) / centerX) * 18 - 14

    setRotate({ x: rotX, y: rotY })
    setGlare({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.15,
    })
  }

  const handleMouseLeave = () => {
    // Return to default elegant isometric angle
    setRotate({ x: 12, y: -14 })
    setGlare((prev) => ({ ...prev, opacity: 0 }))
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative mx-auto w-full max-w-5xl py-6 [perspective:1200px]"
    >
      {/* 3D Multi-plane Transform Container */}
      <div
        style={{
          transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
          transformStyle: "preserve-3d",
          transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        className="relative will-change-transform"
      >
        {/* Ambient Glow behind workspace */}
        <div className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-tr from-primary/20 via-sky-500/15 to-purple-600/20 blur-2xl opacity-70" />

        {/* ======================================================== */}
        {/* LAYER 1 (BASE Z: 0px): Main Monaco Editor & File Explorer */}
        {/* ======================================================== */}
        <div
          style={{ transform: "translateZ(0px)" }}
          className="relative rounded-2xl border border-border/80 bg-card/90 shadow-2xl backdrop-blur-xl transition-shadow duration-500 hover:shadow-primary/10 overflow-hidden"
        >
          {/* Glare specular overlay */}
          <div
            className="pointer-events-none absolute inset-0 z-50 rounded-2xl transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle 400px at ${glare.x}% ${glare.y}%, rgba(255,255,255,${glare.opacity}), transparent 80%)`,
            }}
          />

          {/* Window Header */}
          <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-red-500/80" />
              <span className="size-3 rounded-full bg-amber-500/80" />
              <span className="size-3 rounded-full bg-emerald-500/80" />
              <div className="ml-3 flex items-center gap-2 text-xs text-muted-foreground">
                <BoxIcon className="size-3.5 text-primary" />
                <span className="font-mono font-medium text-foreground">cloud-agent</span>
                <span>/</span>
                <span className="font-mono">{activePreset === "chat" ? "ai-chat-live" : "kanban-board"}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden sm:inline-flex gap-1 py-0.5 text-[11px] font-mono border-emerald-500/30 text-emerald-500 bg-emerald-500/10">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Docker Sandbox Active
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1 py-0.5 text-[11px] font-mono">
                <GitBranchIcon className="size-3 text-sky-500" />
                feat/realtime-sync
              </Badge>
            </div>
          </div>

          {/* Editor Body Grid: Sidebar Explorer + Monaco Code Tabs */}
          <div className="grid grid-cols-12 min-h-[380px] text-xs font-mono">
            {/* Left Explorer Sidebar */}
            <div className="col-span-3 hidden md:flex flex-col border-r border-border/50 bg-muted/20 p-3 select-none">
              <div className="flex items-center justify-between pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                <span className="flex items-center gap-1.5">
                  <FolderTreeIcon className="size-3.5" />
                  Files
                </span>
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                  isolated
                </Badge>
              </div>

              <div className="flex flex-col gap-1 pt-1 text-muted-foreground">
                <div className="flex items-center gap-1.5 text-foreground font-medium">
                  <span className="text-primary font-bold">▾</span>
                  <span>src/</span>
                </div>
                <div
                  onClick={() => setActiveTab("App.tsx")}
                  className={`ml-4 flex items-center gap-2 rounded px-2 py-1 cursor-pointer transition-colors ${
                    activeTab === "App.tsx" ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
                  }`}
                >
                  <FileCode2Icon className="size-3 text-sky-400" />
                  <span>App.tsx</span>
                </div>
                <div
                  onClick={() => setActiveTab("server.ts")}
                  className={`ml-4 flex items-center gap-2 rounded px-2 py-1 cursor-pointer transition-colors ${
                    activeTab === "server.ts" ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
                  }`}
                >
                  <FileCode2Icon className="size-3 text-emerald-400" />
                  <span>server.ts</span>
                </div>
                <div
                  onClick={() => setActiveTab("Dockerfile")}
                  className={`ml-4 flex items-center gap-2 rounded px-2 py-1 cursor-pointer transition-colors ${
                    activeTab === "Dockerfile" ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
                  }`}
                >
                  <BoxIcon className="size-3 text-purple-400" />
                  <span>Dockerfile</span>
                </div>
                <div className="ml-4 flex items-center gap-2 px-2 py-1 text-muted-foreground/60">
                  <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                  <span>package.json</span>
                </div>
                <div className="ml-4 flex items-center gap-2 px-2 py-1 text-muted-foreground/60">
                  <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                  <span>vite.config.ts</span>
                </div>
              </div>

              {/* In-Container Volume Status */}
              <div className="mt-auto rounded-lg border border-border/60 bg-background/50 p-2.5 text-[11px]">
                <div className="text-muted-foreground flex items-center gap-1">
                  <BoxIcon className="size-3 text-sky-400" />
                  Volume: <span className="text-foreground">ws_901b</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Host Access:</span>
                  <span className="text-emerald-500 font-semibold">Blocked (0)</span>
                </div>
              </div>
            </div>

            {/* Right Monaco Code Area */}
            <div className="col-span-12 md:col-span-9 flex flex-col bg-background/70">
              {/* Tab Bar */}
              <div className="flex items-center border-b border-border/50 bg-muted/30 px-2">
                <button
                  onClick={() => setActiveTab("App.tsx")}
                  className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs transition-colors ${
                    activeTab === "App.tsx"
                      ? "border-primary text-foreground bg-background/60 font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileCode2Icon className="size-3 text-sky-400" />
                  App.tsx
                </button>
                <button
                  onClick={() => setActiveTab("server.ts")}
                  className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs transition-colors ${
                    activeTab === "server.ts"
                      ? "border-primary text-foreground bg-background/60 font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileCode2Icon className="size-3 text-emerald-400" />
                  server.ts
                </button>
                <button
                  onClick={() => setActiveTab("Dockerfile")}
                  className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs transition-colors ${
                    activeTab === "Dockerfile"
                      ? "border-primary text-foreground bg-background/60 font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <BoxIcon className="size-3 text-purple-400" />
                  Dockerfile
                </button>
              </div>

              {/* Code Content */}
              <div className="flex-1 p-4 font-mono text-[12px] leading-relaxed overflow-x-auto">
                {activeTab === "App.tsx" && (
                  <div className="flex flex-col gap-0.5">
                    <div className="text-muted-foreground/60">// ⚡ Autonomously generated by Cloud Agent inside container</div>
                    <div>
                      <span className="text-purple-400">import</span> React, &#123; useState, useEffect &#125;{" "}
                      <span className="text-purple-400">from</span> <span className="text-emerald-400">"react"</span>;
                    </div>
                    <div>
                      <span className="text-purple-400">import</span> &#123; KanbanBoard, Column &#125;{" "}
                      <span className="text-purple-400">from</span> <span className="text-emerald-400">"@cloud-agent/ui"</span>;
                    </div>
                    <div className="h-2" />
                    <div>
                      <span className="text-sky-400">export function</span> <span className="text-amber-300">App</span>() &#123;
                    </div>
                    <div className="pl-4">
                      <span className="text-purple-400">const</span> [tasks, setTasks] ={" "}
                      <span className="text-amber-300">useState</span>([
                    </div>
                    <div className="pl-8 text-muted-foreground">
                      &#123; id: <span className="text-sky-300">"1"</span>, title:{" "}
                      <span className="text-emerald-400">"Setup Container Sandbox"</span>, status:{" "}
                      <span className="text-emerald-400">"done"</span> &#125;,
                    </div>
                    <div className="pl-8 text-emerald-400 font-semibold bg-emerald-500/10 rounded px-1 -mx-1">
                      + &#123; id: <span className="text-sky-300">"2"</span>, title:{" "}
                      <span className="text-emerald-300">"Bind Live Preview Proxy (0.0.0.0)"</span>, status:{" "}
                      <span className="text-emerald-300">"in-progress"</span> &#125;,
                    </div>
                    <div className="pl-8 text-emerald-400 font-semibold bg-emerald-500/10 rounded px-1 -mx-1">
                      + &#123; id: <span className="text-sky-300">"3"</span>, title:{" "}
                      <span className="text-emerald-300">"Automate Git Checkpoint Commit"</span>, status:{" "}
                      <span className="text-emerald-300">"ready"</span> &#125;
                    </div>
                    <div className="pl-4">]);</div>
                    <div className="h-2" />
                    <div className="pl-4">
                      <span className="text-purple-400">return</span> (
                    </div>
                    <div className="pl-8">
                      &lt;<span className="text-sky-400">KanbanBoard</span> items=&#123;tasks&#125; onReorder=&#123;setTasks&#125; /&gt;
                    </div>
                    <div className="pl-4">);</div>
                    <div>&#125;</div>
                  </div>
                )}

                {activeTab === "server.ts" && (
                  <div className="flex flex-col gap-0.5">
                    <div><span className="text-purple-400">import</span> express <span className="text-purple-400">from</span> <span className="text-emerald-400">"express"</span>;</div>
                    <div><span className="text-purple-400">import</span> &#123; createServer &#125; <span className="text-purple-400">from</span> <span className="text-emerald-400">"http"</span>;</div>
                    <div className="h-2" />
                    <div><span className="text-purple-400">const</span> app = <span className="text-amber-300">express</span>();</div>
                    <div><span className="text-purple-400">const</span> PORT = <span className="text-amber-300">3000</span>;</div>
                    <div className="h-2" />
                    <div className="bg-emerald-500/10 rounded px-1 -mx-1 text-emerald-400">
                      + app.<span className="text-amber-300">listen</span>(PORT, <span className="text-emerald-300">"0.0.0.0"</span>, () =&gt; console.log(<span className="text-emerald-300">"Backend listening on port 3000"</span>));
                    </div>
                  </div>
                )}

                {activeTab === "Dockerfile" && (
                  <div className="flex flex-col gap-0.5">
                    <div><span className="text-purple-400">FROM</span> node:20-slim</div>
                    <div><span className="text-purple-400">WORKDIR</span> /app</div>
                    <div><span className="text-purple-400">EXPOSE</span> 4000 3000</div>
                    <div><span className="text-purple-400">CMD</span> [<span className="text-emerald-400">"npm"</span>, <span className="text-emerald-400">"run"</span>, <span className="text-emerald-400">"dev"</span>]</div>
                  </div>
                )}
              </div>

              {/* Status Footer */}
              <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-sky-400">
                    <CheckCircle2Icon className="size-3" /> UTF-8
                  </span>
                  <span>TypeScript React</span>
                  <span>Ln 14, Col 22</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Prettier: active</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* LAYER 2 (FLOATING Z: 45px): In-Container Terminal Card    */}
        {/* ======================================================== */}
        <div
          style={{ transform: "translateZ(45px)" }}
          className="absolute -bottom-8 -left-4 md:-left-8 z-20 w-80 md:w-96 rounded-xl border border-sky-500/40 bg-card/95 shadow-2xl backdrop-blur-xl p-3.5 text-xs font-mono"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2">
            <div className="flex items-center gap-1.5 text-foreground font-semibold">
              <TerminalIcon className="size-3.5 text-sky-400" />
              <span>Container XTerm</span>
            </div>
            <Badge variant="secondary" className="text-[10px] font-mono px-1 py-0 text-emerald-400 bg-emerald-500/10">
              /app/src
            </Badge>
          </div>

          <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            <div>
              <span className="text-emerald-400">root@sandbox:/app#</span> docker run -v cloud_agent_ws_901b:/app
            </div>
            <div>
              <span className="text-sky-400">➜</span> npm run build:all
            </div>
            <div className="text-emerald-400">✔ Frontend compiled in 840ms</div>
            <div className="text-emerald-400">✔ Backend listening on 0.0.0.0:3000</div>
            <div className="text-foreground flex items-center gap-1.5 mt-0.5">
              <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-sky-300 font-semibold">Live Preview Ready:</span>
              <span className="text-muted-foreground underline">0.0.0.0:4000</span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* LAYER 3 (FLOATING Z: 75px): Live Browser Preview Window   */}
        {/* ======================================================== */}
        <div
          style={{ transform: "translateZ(75px)" }}
          className="absolute -top-10 -right-2 md:-right-8 z-30 w-72 md:w-84 rounded-xl border border-purple-500/40 bg-card/95 shadow-2xl backdrop-blur-xl p-3 text-xs"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5 bg-muted/60 rounded px-2 py-0.5 text-[11px] font-mono text-muted-foreground flex-1 mr-2 truncate">
              <GlobeIcon className="size-3 text-purple-400 shrink-0" />
              <span className="truncate">https://app-901b.cloudagent.dev</span>
            </div>
            <RefreshCwIcon className="size-3 text-muted-foreground hover:text-foreground cursor-pointer transition-transform hover:rotate-180 duration-500" />
          </div>

          {/* Interactive Mini App Live Preview */}
          <div className="rounded-lg border border-border/50 bg-background/80 p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground text-xs">Kanban Tasks</span>
              <Badge variant="outline" className="text-[10px] text-purple-400 border-purple-500/30">
                Live Preview
              </Badge>
            </div>

            {/* Task Cards Preview */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between rounded bg-muted/50 p-1.5 text-[11px]">
                <span className="text-foreground">⚡ Docker volume mount</span>
                <span className="text-[10px] text-emerald-400 font-medium">DONE</span>
              </div>
              <div className="flex items-center justify-between rounded bg-primary/10 border border-primary/20 p-1.5 text-[11px]">
                <span className="text-primary font-medium">✨ Realtime Subdomain</span>
                <span className="text-[10px] text-sky-400 font-medium">ACTIVE</span>
              </div>
            </div>

            {/* Interactive counter testing live reactivity */}
            <div className="mt-1 flex items-center justify-between pt-2 border-t border-border/40">
              <span className="text-[11px] text-muted-foreground">Test Reactivity:</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setCounter((c) => c + 1)
                }}
                className="flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 transition-all active:scale-95"
              >
                Clicks: {counter}
              </button>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* LAYER 4 (FLOATING Z: 95px): Floating Agent Thought Pill   */}
        {/* ======================================================== */}
        <div
          style={{ transform: "translateZ(95px)" }}
          className="absolute top-1/2 -left-2 md:-left-12 -translate-y-1/2 z-40 hidden sm:flex items-center gap-2 rounded-full border border-sky-500/50 bg-background/95 px-3.5 py-1.5 shadow-2xl backdrop-blur-xl text-xs font-medium"
        >
          <SparklesIcon className="size-3.5 text-sky-400 animate-spin" style={{ animationDuration: "3s" }} />
          <span className="text-muted-foreground">Cloud Agent:</span>
          <span className="text-foreground font-semibold">"Hot reload synced in 320ms"</span>
        </div>
      </div>
    </div>
  )
}
