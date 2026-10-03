import { useEffect, useState } from "react"

export interface SwissScrollProgress {
  p1: number
  p2: number
  p3: number
  p4: number
}

export function useSwissScrollProgress() {
  const [progress, setProgress] = useState<SwissScrollProgress>({
    p1: 0,
    p2: 0,
    p3: 0,
    p4: 0,
  })

  useEffect(() => {
    let animId: number
    let lastP1 = -1
    let lastP2 = -1
    let lastP3 = -1
    let lastP4 = -1

    const handleScroll = () => {
      const scroll = window.scrollY
      const wh = window.innerHeight

      const hero = document.getElementById("hero")
      const wipe = document.getElementById("wipe")
      const time = document.getElementById("timeline")
      const map = document.getElementById("map")

      const getP = (el: HTMLElement | null) => {
        if (!el) return 0
        const total = el.offsetHeight - wh
        if (total <= 0) return 0
        return Math.max(0, Math.min(1, (scroll - el.offsetTop) / total))
      }

      const p1 = getP(hero)
      const p2 = getP(wipe)
      const p3 = getP(time)
      const p4 = getP(map)

      // Update CSS variables on documentElement for CSS styling
      document.documentElement.style.setProperty("--p1", p1.toString())
      document.documentElement.style.setProperty("--p2", p2.toString())
      document.documentElement.style.setProperty("--p3", p3.toString())
      document.documentElement.style.setProperty("--p4", p4.toString())

      // Only update state if difference exceeds epsilon to prevent needless React re-renders
      if (
        Math.abs(p1 - lastP1) > 0.005 ||
        Math.abs(p2 - lastP2) > 0.005 ||
        Math.abs(p3 - lastP3) > 0.005 ||
        Math.abs(p4 - lastP4) > 0.005
      ) {
        lastP1 = p1
        lastP2 = p2
        lastP3 = p3
        lastP4 = p4
        setProgress({ p1, p2, p3, p4 })
      }

      animId = requestAnimationFrame(handleScroll)
    }

    animId = requestAnimationFrame(handleScroll)

    return () => {
      cancelAnimationFrame(animId)
    }
  }, [])

  return progress
}
