import { useEffect, useRef } from "react"

interface Particle3D {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  size: number
  color: string
}

interface Node3D {
  x: number
  y: number
  z: number
}

interface Edge3D {
  a: number
  b: number
}

export function HeroScene3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctxInit = canvas.getContext("2d", { alpha: true })
    if (!ctxInit) return
    const ctx = ctxInit

    let animId: number
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth)
    let height = (canvas.height = canvas.parentElement?.clientHeight || 700)

    // Check dark mode
    let isDark = document.documentElement.classList.contains("dark")
    const themeObserver = new MutationObserver(() => {
      isDark = document.documentElement.classList.contains("dark")
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })

    // Generate 3D Core Polyhedron (Icosahedron-like structure)
    const phi = (1 + Math.sqrt(5)) / 2
    const baseRadius = Math.min(width, height) * 0.22
    const rawVertices: [number, number, number][] = [
      [-1, phi, 0],
      [1, phi, 0],
      [-1, -phi, 0],
      [1, -phi, 0],
      [0, -1, phi],
      [0, 1, phi],
      [0, -1, -phi],
      [0, 1, -phi],
      [phi, 0, -1],
      [phi, 0, 1],
      [-phi, 0, -1],
      [-phi, 0, 1],
    ]

    const vertices: Node3D[] = rawVertices.map(([x, y, z]) => {
      const len = Math.sqrt(x * x + y * y + z * z)
      return {
        x: (x / len) * baseRadius,
        y: (y / len) * baseRadius,
        z: (z / len) * baseRadius,
      }
    })

    // Edges connecting nearby vertices
    const edges: Edge3D[] = []
    const edgeDistSq = (baseRadius * 1.15) * (baseRadius * 1.15)
    for (let i = 0; i < vertices.length; i++) {
      for (let j = i + 1; j < vertices.length; j++) {
        const dx = vertices[i].x - vertices[j].x
        const dy = vertices[i].y - vertices[j].y
        const dz = vertices[i].z - vertices[j].z
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 <= edgeDistSq) {
          edges.push({ a: i, b: j })
        }
      }
    }

    // Outer Ring Nodes
    const ringNodes: Node3D[] = []
    const ringCount = 28
    const ringRadius = baseRadius * 1.55
    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2
      ringNodes.push({
        x: Math.cos(angle) * ringRadius,
        y: Math.sin(angle) * ringRadius * 0.35,
        z: Math.sin(angle) * ringRadius * 0.95,
      })
    }

    // Floating 3D Starfield / Particle Cloud
    const particleCount = 75
    const particles: Particle3D[] = []
    const colorsDark = [
      "rgba(56, 189, 248, ", // Cyan
      "rgba(168, 85, 247, ", // Violet
      "rgba(52, 211, 153, ", // Emerald
      "rgba(99, 102, 241, ", // Indigo
    ]
    const colorsLight = [
      "rgba(14, 165, 233, ", // Sky
      "rgba(124, 58, 237, ", // Violet
      "rgba(16, 185, 129, ", // Emerald
      "rgba(67, 56, 202, ",  // Indigo
    ]

    for (let i = 0; i < particleCount; i++) {
      const spreadX = width * 0.6
      const spreadY = height * 0.5
      const spreadZ = 400
      particles.push({
        x: (Math.random() - 0.5) * spreadX,
        y: (Math.random() - 0.5) * spreadY,
        z: (Math.random() - 0.5) * spreadZ,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        vz: (Math.random() - 0.5) * 0.35,
        size: Math.random() * 2 + 1,
        color: (isDark ? colorsDark : colorsLight)[i % colorsDark.length],
      })
    }

    // Mouse Tracking with smooth spring lerp
    let targetRotX = 0.2
    let targetRotY = 0
    let rotX = 0.2
    let rotY = 0
    let rotZ = 0

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / width - 0.5
      const ny = (e.clientY - rect.top) / height - 0.5
      targetRotY = nx * 0.9
      targetRotX = -ny * 0.7 + 0.15
    }

    window.addEventListener("mousemove", handleMouseMove)

    // Resize Handler
    const handleResize = () => {
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth
      height = canvas.height = canvas.parentElement?.clientHeight || 700
    }
    window.addEventListener("resize", handleResize)

    // 3D Rotation Matrix projection
    const fov = 650
    function project(x: number, y: number, z: number): { px: number; py: number; scale: number; visible: boolean } {
      // Rotate Y
      const cosY = Math.cos(rotY)
      const sinY = Math.sin(rotY)
      const x1 = x * cosY + z * sinY
      const z1 = -x * sinY + z * cosY

      // Rotate X
      const cosX = Math.cos(rotX)
      const sinX = Math.sin(rotX)
      const y2 = y * cosX - z1 * sinX
      const z2 = y * sinX + z1 * cosX

      // Rotate Z (ambient slow drift)
      const cosZ = Math.cos(rotZ)
      const sinZ = Math.sin(rotZ)
      const x3 = x1 * cosZ - y2 * sinZ
      const y3 = x1 * sinZ + y2 * cosZ

      const cameraZ = z2 + 800
      if (cameraZ <= 10) return { px: 0, py: 0, scale: 0, visible: false }

      const scale = fov / cameraZ
      const px = width / 2 + x3 * scale
      const py = height / 2 + y3 * scale

      return { px, py, scale, visible: true }
    }

    let time = 0
    function render() {
      time += 0.008

      // Smooth camera damping
      rotX += (targetRotX - rotX) * 0.04
      rotY += (targetRotY - rotY) * 0.04
      rotZ = Math.sin(time * 0.5) * 0.08

      ctx.clearRect(0, 0, width, height)

      // Ambient Cybernetic Radial Glow
      const glowGrad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        20,
        width / 2,
        height / 2,
        Math.min(width, height) * 0.65
      )
      if (isDark) {
        glowGrad.addColorStop(0, "rgba(56, 189, 248, 0.09)")
        glowGrad.addColorStop(0.4, "rgba(168, 85, 247, 0.05)")
        glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)")
      } else {
        glowGrad.addColorStop(0, "rgba(99, 102, 241, 0.07)")
        glowGrad.addColorStop(0.4, "rgba(14, 165, 233, 0.04)")
        glowGrad.addColorStop(1, "rgba(255, 255, 255, 0)")
      }
      ctx.fillStyle = glowGrad
      ctx.fillRect(0, 0, width, height)

      // 1. Draw 3D Polyhedron Edges
      ctx.lineWidth = 1.2
      const strokeColor = isDark
        ? "rgba(147, 197, 253, 0.22)"
        : "rgba(99, 102, 241, 0.18)"
      ctx.strokeStyle = strokeColor

      const projectedVertices = vertices.map((v) => {
        // slight pulsating breath
        const pulse = 1 + Math.sin(time * 2) * 0.03
        return project(v.x * pulse, v.y * pulse, v.z * pulse)
      })

      ctx.beginPath()
      for (const edge of edges) {
        const p1 = projectedVertices[edge.a]
        const p2 = projectedVertices[edge.b]
        if (p1.visible && p2.visible) {
          ctx.moveTo(p1.px, p1.py)
          ctx.lineTo(p2.px, p2.py)
        }
      }
      ctx.stroke()

      // 2. Draw 3D Polyhedron Vertices (Nodes)
      for (const p of projectedVertices) {
        if (!p.visible) continue
        const r = Math.max(1, p.scale * 3.5)
        ctx.beginPath()
        ctx.arc(p.px, p.py, r, 0, Math.PI * 2)
        ctx.fillStyle = isDark ? "rgba(56, 189, 248, 0.85)" : "rgba(79, 70, 229, 0.85)"
        ctx.fill()

        // Glow ring around nodes
        ctx.beginPath()
        ctx.arc(p.px, p.py, r * 2.2, 0, Math.PI * 2)
        ctx.fillStyle = isDark ? "rgba(168, 85, 247, 0.25)" : "rgba(124, 58, 237, 0.2)"
        ctx.fill()
      }

      // 3. Draw Outer Orbit Ring
      const projectedRing = ringNodes.map((n) => {
        // Rotate around Y slightly faster
        const angle = time * 0.6
        const rx = n.x * Math.cos(angle) - n.z * Math.sin(angle)
        const rz = n.x * Math.sin(angle) + n.z * Math.cos(angle)
        return project(rx, n.y, rz)
      })

      ctx.beginPath()
      let first = true
      for (const rp of projectedRing) {
        if (!rp.visible) continue
        if (first) {
          ctx.moveTo(rp.px, rp.py)
          first = false
        } else {
          ctx.lineTo(rp.px, rp.py)
        }
      }
      ctx.closePath()
      ctx.strokeStyle = isDark
        ? "rgba(168, 85, 247, 0.2)"
        : "rgba(124, 58, 237, 0.16)"
      ctx.stroke()

      for (let i = 0; i < projectedRing.length; i += 3) {
        const rp = projectedRing[i]
        if (!rp.visible) continue
        ctx.beginPath()
        ctx.arc(rp.px, rp.py, rp.scale * 2.5, 0, Math.PI * 2)
        ctx.fillStyle = isDark ? "rgba(52, 211, 153, 0.75)" : "rgba(16, 185, 129, 0.75)"
        ctx.fill()
      }

      // 4. Draw Floating Particles & Neural Connections
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.z += p.vz

        // Wrap around boundary
        const boundaryX = width * 0.65
        const boundaryY = height * 0.55
        if (p.x > boundaryX) p.x = -boundaryX
        if (p.x < -boundaryX) p.x = boundaryX
        if (p.y > boundaryY) p.y = -boundaryY
        if (p.y < -boundaryY) p.y = boundaryY
        if (p.z > 350) p.z = -350
        if (p.z < -350) p.z = 350

        const proj = project(p.x, p.y, p.z)
        if (!proj.visible) continue

        const alpha = Math.min(1, Math.max(0.15, (proj.scale * 0.8)))
        ctx.beginPath()
        ctx.arc(proj.px, proj.py, p.size * proj.scale, 0, Math.PI * 2)
        ctx.fillStyle = `${p.color}${alpha.toFixed(2)})`
        ctx.fill()

        // Neural Connections to nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j]
          const dx = p.x - p2.x
          const dy = p.y - p2.y
          const dz = p.z - p2.z
          const distSq = dx * dx + dy * dy + dz * dz
          if (distSq < 130 * 130) {
            const proj2 = project(p2.x, p2.y, p2.z)
            if (proj2.visible) {
              const lineAlpha = (1 - Math.sqrt(distSq) / 130) * 0.25 * alpha
              ctx.beginPath()
              ctx.moveTo(proj.px, proj.py)
              ctx.lineTo(proj2.px, proj2.py)
              ctx.strokeStyle = isDark
                ? `rgba(147, 197, 253, ${lineAlpha.toFixed(3)})`
                : `rgba(99, 102, 241, ${lineAlpha.toFixed(3)})`
              ctx.lineWidth = 0.75
              ctx.stroke()
            }
          }
        }
      }

      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("resize", handleResize)
      themeObserver.disconnect()
    }
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="size-full opacity-80 transition-opacity duration-700 hover:opacity-100"
      />
      {/* Top and bottom subtle fade masks */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-background to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-background to-transparent" />
    </div>
  )
}
