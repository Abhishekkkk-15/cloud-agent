import { useEffect, useRef } from "react"

interface SwissMapCanvasProps {
  p4: number
}

interface NodePoint {
  x: number
  y: number
}

export function SwissMapCanvas({ p4 }: SwissMapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const p4Ref = useRef(p4)
  p4Ref.current = p4

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let nodes: NodePoint[] = []
    const route = [0, 4, 8, 12, 15, 18, 22, 25]

    const initCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      const width = canvas.parentElement?.clientWidth || window.innerWidth
      const height = canvas.parentElement?.clientHeight || window.innerHeight

      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.resetTransform()
      ctx.scale(dpr, dpr)

      nodes = []
      const centerX = width / 2
      const centerY = height / 2

      for (let i = 0; i < 26; i++) {
        const angle = i * 2.399
        const radius = Math.sqrt(i / 26) * Math.min(width, height) * 0.4
        nodes.push({
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        })
      }
    }

    initCanvas()
    window.addEventListener("resize", initCanvas)

    let animId: number
    const render = () => {
      const p = p4Ref.current
      const width = canvas.width / (window.devicePixelRatio || 1)
      const height = canvas.height / (window.devicePixelRatio || 1)

      ctx.clearRect(0, 0, width, height)

      // 1. Proximity lines between nodes
      ctx.strokeStyle = "rgba(17, 16, 16, 0.08)"
      ctx.lineWidth = 1
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
          if (d < 250) {
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }
      }

      // 2. Node anchor dots
      nodes.forEach((n) => {
        ctx.fillStyle = "rgba(17, 16, 16, 0.25)"
        ctx.beginPath()
        ctx.arc(n.x, n.y, 2.5, 0, Math.PI * 2)
        ctx.fill()
      })

      // 3. Traced route line & active beacon
      const routeLen = route.length - 1
      const currentSegment = p * routeLen
      const segmentIdx = Math.floor(currentSegment)
      const segmentPct = currentSegment % 1

      if (p > 0 && nodes.length > 0) {
        ctx.strokeStyle = "#DC201E"
        ctx.lineWidth = 2.8
        ctx.beginPath()
        ctx.moveTo(nodes[route[0]].x, nodes[route[0]].y)

        for (let i = 1; i <= segmentIdx; i++) {
          ctx.lineTo(nodes[route[i]].x, nodes[route[i]].y)
        }

        if (segmentIdx < routeLen) {
          const start = nodes[route[segmentIdx]]
          const end = nodes[route[segmentIdx + 1]]
          const curX = start.x + (end.x - start.x) * segmentPct
          const curY = start.y + (end.y - start.y) * segmentPct

          ctx.lineTo(curX, curY)
          ctx.stroke()

          // Active node solid center
          ctx.fillStyle = "#DC201E"
          ctx.beginPath()
          ctx.arc(curX, curY, 4, 0, Math.PI * 2)
          ctx.fill()

          // Pulsing halo beacon
          ctx.strokeStyle = "rgba(220, 32, 30, 0.35)"
          ctx.beginPath()
          ctx.arc(curX, curY, 8 + Math.sin(Date.now() / 200) * 3, 0, Math.PI * 2)
          ctx.stroke()
        } else {
          ctx.stroke()
        }
      }

      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)

    return () => {
      window.removeEventListener("resize", initCanvas)
      cancelAnimationFrame(animId)
    }
  }, [])

  return (
    <section className="stage-pin map" id="map">
      <div className="sticky-container bg-[var(--paper)]">
        <canvas
          ref={canvasRef}
          id="mapCanvas"
          className="absolute inset-0 w-full h-full map-canvas pointer-events-none"
        />

        <div className="relative z-10 w-full p-8 sm:p-16 flex flex-col justify-end h-full items-start">
          <div className="mono text-xs text-[var(--red)] mb-2">
            TOPOLOGY // SYSTEM MESH GEOMETRY
          </div>
          <h2 className="anton text-4xl sm:text-6xl lg:text-7xl max-w-4xl tracking-tight leading-none">
            EVERY PIPELINE IS A GEOMETRIC OPTIMIZATION.
          </h2>
          <div className="mono mt-6 text-xs text-[var(--grey)]">
            CLUSTER TOPOLOGY 04 / PROXIMITY DIRECTED ACYCLIC GRAPH
          </div>
        </div>
      </div>
    </section>
  )
}
