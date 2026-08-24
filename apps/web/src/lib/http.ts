import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios"

const ACCESS_KEY = "ca_access_token"
const REFRESH_KEY = "ca_refresh_token"

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY)
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken)
  localStorage.setItem(REFRESH_KEY, refreshToken)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

export function getApiErrorMessage(error: unknown, fallback = "Request failed") {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === "string" && detail) return detail
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg)
    return error.message || fallback
  }
  if (error instanceof Error) return error.message
  return fallback
}

export const http = axios.create({
  baseURL: "/api",
  timeout: 12000,
})

http.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshing: Promise<string | null> | null = null

async function refreshAccessToken() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null
  const { data } = await axios.post("/api/auth/refresh", {
    refresh_token: refreshToken,
  })
  setTokens(data.access_token, data.refresh_token)
  return data.access_token as string
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }
    const url = original?.url ?? ""
    const isAuthRoute =
      url.includes("/auth/google") || url.includes("/auth/refresh")
    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      isAuthRoute
    ) {
      throw error
    }
    original._retry = true
    refreshing ??= refreshAccessToken().finally(() => {
      refreshing = null
    })
    const token = await refreshing
    if (!token) {
      clearTokens()
      throw error
    }
    original.headers.Authorization = `Bearer ${token}`
    return http(original)
  }
)
