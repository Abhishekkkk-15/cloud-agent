import { useEffect, useRef } from "react"

interface Dove {
  x: number
  y: number
  z: number // Depth: 0.3 (far) to 1.2 (near)
  vx: number
  vy: number
  scale: number
  angle: number
  flapTimer: number
  flapState: "spread" | "soar" | "glide"
  flapSpeed: number
  gliding: boolean
  glideTimer: number
  baseY: number
  wavePhase: number
}

interface Particle {
  x: number
  y: number
  size: number
  opacity: number
  speedY: number
  speedX: number
  pulse: number
}

export function DigitalArchiveScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    // Mouse parallax tracking with spring physics
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 }

    const onMouseMove = (e: MouseEvent) => {
      // Normalized between -1 and 1
      mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1
      mouse.targetY = (e.clientY / window.innerHeight) * 2 - 1
    }

    const onResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    window.addEventListener("mousemove", onMouseMove, { passive: true })
    window.addEventListener("resize", onResize)

    // Preload Images
    const bgImg = new Image()
    bgImg.src = "/renaissance-sky.jpg"

    const doveSpreadImg = new Image()
    doveSpreadImg.src = "/dove_spread.png"

    const doveSoarImg = new Image()
    doveSoarImg.src = "/dove_soar.png"

    const doveGlideImg = new Image()
    doveGlideImg.src = "/dove_glide.png"

    // Initialize 6 Doves at various depths and trajectories
    const doves: Dove[] = [
      {
        x: width * 0.85,
        y: height * 0.18,
        z: 0.95,
        vx: -1.3,
        vy: 0.35,
        scale: 0.8,
        angle: -0.22,
        flapTimer: 0,
        flapState: "glide",
        flapSpeed: 0.14,
        gliding: true,
        glideTimer: 120,
        baseY: height * 0.18,
        wavePhase: 0,
      },
      {
        x: width * 0.12,
        y: height * 0.28,
        z: 1.1,
        vx: 1.5,
        vy: -0.4,
        scale: 0.9,
        angle: 0.18,
        flapTimer: 2,
        flapState: "spread",
        flapSpeed: 0.18,
        gliding: false,
        glideTimer: 0,
        baseY: height * 0.28,
        wavePhase: 1.5,
      },
      {
        x: width * 0.08,
        y: height * 0.15,
        z: 0.55,
        vx: 0.85,
        vy: -0.15,
        scale: 0.45,
        angle: 0.12,
        flapTimer: 4,
        flapState: "glide",
        flapSpeed: 0.12,
        gliding: true,
        glideTimer: 90,
        baseY: height * 0.15,
        wavePhase: 3.0,
      },
      {
        x: width * 0.65,
        y: height * 0.72,
        z: 0.7,
        vx: 1.1,
        vy: -0.5,
        scale: 0.55,
        angle: 0.25,
        flapTimer: 1,
        flapState: "soar",
        flapSpeed: 0.16,
        gliding: false,
        glideTimer: 0,
        baseY: height * 0.72,
        wavePhase: 4.2,
      },
      {
        x: width * 0.92,
        y: height * 0.65,
        z: 0.4,
        vx: -0.7,
        vy: 0.15,
        scale: 0.35,
        angle: -0.15,
        flapTimer: 3,
        flapState: "glide",
        flapSpeed: 0.1,
        gliding: true,
        glideTimer: 180,
        baseY: height * 0.65,
        wavePhase: 2.1,
      },
      {
        x: width * 0.35,
        y: height * 0.82,
        z: 1.15,
        vx: 1.4,
        vy: -0.45,
        scale: 0.95,
        angle: 0.2,
        flapTimer: 0.5,
        flapState: "spread",
        flapSpeed: 0.17,
        gliding: false,
        glideTimer: 0,
        baseY: height * 0.82,
        wavePhase: 5.5,
      },
    ]

    // Initialize 45 Atmospheric Dust / Light Motes
    const particles: Particle[] = Array.from({ length: 45 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2.2 + 0.8,
      opacity: Math.random() * 0.5 + 0.2,
      speedY: -(Math.random() * 0.35 + 0.15),
      speedX: (Math.random() - 0.5) * 0.25,
      pulse: Math.random() * Math.PI * 2,
    }))

    let lastTime = performance.now()

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1)
      lastTime = time

      // Spring mouse interpolation
      mouse.x += (mouse.targetX - mouse.x) * 0.05
      mouse.y += (mouse.targetY - mouse.y) * 0.05

      ctx.clearRect(0, 0, width, height)

      // ----------------------------------------------------
      // LAYER 1: Renaissance Oil Painting Sky Background
      // ----------------------------------------------------
      if (bgImg.complete && bgImg.naturalWidth > 0) {
        // Draw background with subtle 3D parallax shift
        const parallaxX = -mouse.x * 25
        const parallaxY = -mouse.y * 20
        const scale = 1.08 // slight zoom for parallax margin
        const bgW = width * scale
        const bgH = height * scale
        const bgX = (width - bgW) / 2 + parallaxX
        const bgY = (height - bgH) / 2 + parallaxY

        ctx.drawImage(bgImg, bgX, bgY, bgW, bgH)
      } else {
        // Fallback rich chiaroscuro gradient
        const grad = ctx.createLinearGradient(0, 0, 0, height)
        grad.addColorStop(0, "#2c3b52")
        grad.addColorStop(0.35, "#825a36")
        grad.addColorStop(0.65, "#d4973b")
        grad.addColorStop(1, "#c96c2a")
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, width, height)
      }

      // ----------------------------------------------------
      // LAYER 2: Warm Volumetric Ambient Glow & Sunbreak
      // ----------------------------------------------------
      const sunCenterX = width * 0.5 + mouse.x * 35
      const sunCenterY = height * 0.48 + mouse.y * 25
      const sunGlow = ctx.createRadialGradient(
        sunCenterX,
        sunCenterY,
        20,
        sunCenterX,
        sunCenterY,
        width * 0.55
      )
      sunGlow.addColorStop(0, "rgba(255, 235, 175, 0.28)")
      sunGlow.addColorStop(0.3, "rgba(240, 180, 80, 0.15)")
      sunGlow.addColorStop(0.7, "rgba(200, 110, 40, 0.06)")
      sunGlow.addColorStop(1, "rgba(0, 0, 0, 0)")
      ctx.fillStyle = sunGlow
      ctx.fillRect(0, 0, width, height)

      // ----------------------------------------------------
      // LAYER 3: Golden Dust Particles / Floating Light Motes
      // ----------------------------------------------------
      for (const p of particles) {
        p.y += p.speedY
        p.x += p.speedX + mouse.x * 0.2
        p.pulse += dt * 1.5

        if (p.y < -20) {
          p.y = height + 10
          p.x = Math.random() * width
        }

        const alpha = p.opacity * (0.6 + Math.sin(p.pulse) * 0.4)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 245, 215, ${alpha})`
        ctx.shadowColor = "rgba(255, 220, 130, 0.6)"
        ctx.shadowBlur = 8
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // ----------------------------------------------------
      // LAYER 4: Flying White Doves (Multi-plane Parallax)
      // ----------------------------------------------------
      // Sort doves by depth (draw distant ones first)
      const sortedDoves = [...doves].sort((a, b) => a.z - b.z)

      for (const dove of sortedDoves) {
        // Update flight state and flap animation
        dove.wavePhase += dt * 2.2
        const waveOffset = Math.sin(dove.wavePhase) * (18 * dove.z)

        dove.x += dove.vx * (0.8 + dove.z * 0.6)
        dove.y += dove.vy + (Math.cos(dove.wavePhase) * 0.4)

        // Mouse Parallax displacement based on depth
        const parallaxOffsetX = mouse.x * (dove.z * 40)
        const parallaxOffsetY = mouse.y * (dove.z * 30)

        // Flap cycle logic
        dove.flapTimer += dove.flapSpeed
        if (dove.gliding) {
          dove.flapState = "glide"
          dove.glideTimer -= 1
          if (dove.glideTimer <= 0) {
            dove.gliding = false
            dove.flapTimer = 0
          }
        } else {
          // Alternating spread -> soar -> spread -> glide
          const cycle = Math.floor(dove.flapTimer) % 6
          if (cycle === 0 || cycle === 3) {
            dove.flapState = "spread"
          } else if (cycle === 1 || cycle === 4) {
            dove.flapState = "soar"
          } else if (cycle === 2 || cycle === 5) {
            dove.flapState = "glide"
          }

          if (dove.flapTimer > 18 && Math.random() < 0.08) {
            dove.gliding = true
            dove.glideTimer = Math.floor(Math.random() * 80 + 60)
          }
        }

        // Loop bounds with respawn
        if (dove.vx > 0 && dove.x > width + 150) {
          dove.x = -150
          dove.y = Math.random() * (height * 0.7) + 50
        } else if (dove.vx < 0 && dove.x < -150) {
          dove.x = width + 150
          dove.y = Math.random() * (height * 0.7) + 50
        }

        // Render current dove frame
        let currentImg = doveSpreadImg
        if (dove.flapState === "soar" && doveSoarImg.complete) {
          currentImg = doveSoarImg
        } else if (dove.flapState === "glide" && doveGlideImg.complete) {
          currentImg = doveGlideImg
        } else if (doveSpreadImg.complete) {
          currentImg = doveSpreadImg
        }

        if (currentImg.complete && currentImg.naturalWidth > 0) {
          ctx.save()

          const drawX = dove.x + parallaxOffsetX
          const drawY = dove.y + waveOffset + parallaxOffsetY

          ctx.translate(drawX, drawY)

          // Mirror if flying left
          const facing = dove.vx < 0 ? -1 : 1
          ctx.scale(facing, 1)

          // Bank angle
          const currentAngle = dove.angle + Math.sin(dove.wavePhase * 0.8) * 0.08
          ctx.rotate(currentAngle * facing)

          // Scale according to depth and distance
          const finalScale = (dove.scale * dove.z * 0.16)
          const targetW = currentImg.naturalWidth * finalScale
          const targetH = currentImg.naturalHeight * finalScale

          // Ambient depth opacity & atmospheric hazing
          ctx.globalAlpha = Math.min(0.98, 0.65 + dove.z * 0.35)

          // Subtle sunbeam illumination on dove wings
          ctx.shadowColor = "rgba(255, 230, 160, 0.4)"
          ctx.shadowBlur = 12 * dove.z

          ctx.drawImage(
            currentImg,
            -targetW / 2,
            -targetH / 2,
            targetW,
            targetH
          )

          ctx.restore()
        }
      }

      // ----------------------------------------------------
      // LAYER 5: Painterly Vignette & Cinematic Framing
      // ----------------------------------------------------
      const vignette = ctx.createRadialGradient(
        width / 2,
        height / 2,
        width * 0.35,
        width / 2,
        height / 2,
        width * 0.75
      )
      vignette.addColorStop(0, "rgba(0, 0, 0, 0)")
      vignette.addColorStop(0.7, "rgba(25, 18, 12, 0.25)")
      vignette.addColorStop(1, "rgba(10, 6, 4, 0.65)")
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, width, height)

      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)

    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("resize", onResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 h-full w-full"
    />
  )
}
