// src/utils/subdomain.ts

export function getSubdomain(): string | null {
  const hostname = window.location.hostname // e.g., "project-alpha.lvh.me"

  // Check if we are running locally on lvh.me or localhost
  const isLocalhost =
    hostname.includes("lvh.me") || hostname.includes("localhost")

  if (!isLocalhost) {
    // Production logic: handle your main domain (e.g., preview.yourdomain.com)
    const parts = hostname.split(".")
    if (parts.length > 2) {
      return parts[0] // Returns "project-alpha"
    }
    return null
  }

  // Localhost logic: extract the first segment before .lvh.me or .localhost
  const parts = hostname.split(".")

  // If user visits "lvh.me" or "localhost" directly (no subdomain)
  if (parts.length === 1 || (parts.length === 2 && parts[1] === "me")) {
    return null
  }

  return parts[0] // Returns "project-alpha" from "project-alpha.lvh.me"
}
