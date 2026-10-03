import { cn } from "@/lib/utils"

interface BrandLogoProps {
  className?: string
  size?: number
}

export function BrandLogo({ className, size = 28 }: BrandLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={cn("shrink-0 select-none", className)}
      aria-label="Cloud Agent Logo"
    >
      {/* Swiss Minimalist Ink Squircle Background */}
      <rect width="32" height="32" rx="7" fill="#111010" />
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="6.5"
        fill="none"
        stroke="rgba(248, 243, 236, 0.16)"
        strokeWidth="1"
      />

      {/* Cyberpunk Technical Alignment Crosshairs */}
      <path
        d="M3.5 6.5 H5.5 M4.5 5.5 V7.5"
        stroke="rgba(248, 243, 236, 0.35)"
        strokeWidth="0.8"
      />
      <path
        d="M3.5 25.5 H5.5 M4.5 24.5 V26.5"
        stroke="rgba(248, 243, 236, 0.35)"
        strokeWidth="0.8"
      />
      <path
        d="M26.5 25.5 H28.5 M27.5 24.5 V26.5"
        stroke="rgba(248, 243, 236, 0.35)"
        strokeWidth="0.8"
      />

      {/* Swiss Signal Red Active Telemetry Beacon (Top-Right) */}
      <circle cx="25" cy="7" r="2.2" fill="#DC201E" />
      <circle
        cx="25"
        cy="7"
        r="3.8"
        fill="none"
        stroke="#DC201E"
        strokeWidth="0.6"
        opacity="0.45"
      />

      {/* Mathematically Centered Cloud Silhouette (X: 4 to 28, Y: 8 to 23.5 -> Center (16, 15.75)) */}
      <path
        d="M 7.5 23.5 C 5.5 23.5 4 21.8 4 19.5 C 4 17.3 5.6 15.6 7.8 15.3 C 8.6 11.2 12 8 16 8 C 20 8 23.4 11.2 24.2 15.3 C 26.4 15.6 28 17.3 28 19.5 C 28 21.8 26.5 23.5 24.5 23.5 Z"
        fill="#F8F3EC"
      />

      {/* Terminal Agent Execution Glyph: >_ (Centered at X=16) */}
      <path
        d="M 11 16.5 L 14.5 18.5 L 11 20.5"
        fill="none"
        stroke="#111010"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="17"
        y1="20.5"
        x2="21"
        y2="20.5"
        stroke="#DC201E"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
