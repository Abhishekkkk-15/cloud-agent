export function getAccessToken(): string | null {
  return "desktop-local-token"
}

export function getApiErrorMessage(error: unknown, fallback: string = "An error occurred"): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return fallback
}
