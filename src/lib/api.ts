import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios"

import { ACCESS_COOKIE, readCookie } from "@/lib/auth-session"

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api"

export interface ApiErrorPayload {
  message: string
  statusCode?: number
  error?: string
  details?: unknown
}

export class ApiError extends Error {
  status: number
  payload: ApiErrorPayload

  constructor(message: string, status: number, payload: ApiErrorPayload) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.payload = payload
  }
}

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 120_000,
  headers: {
    Accept: "application/json",
  },
  withCredentials: false,
})

/**
 * Forward auth + request id from an incoming Next.js request to the backend.
 * The access token comes from the httpOnly session cookie (or an explicit
 * Authorization header) and is sent on as a bearer token.
 */
export function headersFromIncoming(incoming: Headers): Record<string, string> {
  const cookieToken = readCookie(incoming.get("cookie"), ACCESS_COOKIE)
  const auth =
    incoming.get("authorization") ?? (cookieToken ? `Bearer ${cookieToken}` : null)
  const requestId = incoming.get("x-request-id") ?? crypto.randomUUID()
  const headers: Record<string, string> = {
    "X-Request-Id": requestId,
  }
  if (auth) headers.Authorization = auth
  return headers
}

/** Pass through upstream status codes (including 4xx/5xx) without throwing. */
export const proxyValidateStatus = () => true

export function proxyErrorPayload(
  error: unknown,
  fallbackMessage: string,
): { payload: ApiErrorPayload; status: number } {
  if (error instanceof ApiError) {
    return { payload: error.payload, status: error.status || 502 }
  }
  return {
    payload: {
      message: error instanceof Error ? error.message : fallbackMessage,
    },
    status: 502,
  }
}

function attachInterceptors(instance: AxiosInstance) {
  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    if (!config.headers.get?.("X-Request-Id")) {
      config.headers.set?.(
        "X-Request-Id",
        crypto.randomUUID?.() ?? String(Date.now()),
      )
    }
    return config
  })

  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ApiErrorPayload> | ApiError) => {
      // Already converted (e.g. a request replayed after a token refresh).
      if (error instanceof ApiError) return Promise.reject(error)
      if (error.response) {
        const { status, data } = error.response
        const payload: ApiErrorPayload =
          data && typeof data === "object"
            ? data
            : { message: error.message || "Request failed" }

        const message =
          (payload as ApiErrorPayload).message ||
          error.message ||
          `Request failed with status ${status}`

        return Promise.reject(new ApiError(message, status, payload))
      }

      if (error.code === "ECONNABORTED") {
        return Promise.reject(
          new ApiError("Request timed out", 0, { message: "Request timed out" }),
        )
      }

      return Promise.reject(
        new ApiError(error.message || "Network error", 0, {
          message: error.message || "Network error",
        }),
      )
    },
  )
}

attachInterceptors(api)

/** Same-origin Next.js `/api` routes (client-side; avoids CORS). */
export const appApi: AxiosInstance = axios.create({
  baseURL: "/api",
  timeout: 120_000,
  headers: {
    Accept: "application/json",
  },
})

let refreshing: Promise<boolean> | null = null

/**
 * Swap the refresh-token cookie for a new token pair. Concurrent 401s share
 * one call, since Supabase rotates the refresh token on every use.
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= axios
    .post("/api/auth/refresh", null, { timeout: 15_000 })
    .then(
      () => true,
      () => false,
    )
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

function redirectToLogin() {
  const { pathname, search } = window.location
  if (pathname === "/login" || pathname === "/signup") return
  window.location.assign(`/login?next=${encodeURIComponent(pathname + search)}`)
}

// An expired access token makes the backend answer 401: refresh once and
// replay the request; if the refresh token is gone too, go to login.
appApi.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as
    | (InternalAxiosRequestConfig & { _retriedAfterRefresh?: boolean })
    | undefined
  if (
    typeof window !== "undefined" &&
    error.response?.status === 401 &&
    config &&
    !config._retriedAfterRefresh
  ) {
    config._retriedAfterRefresh = true
    if (await refreshSession()) return appApi(config)
    redirectToLogin()
  }
  return Promise.reject(error)
})

attachInterceptors(appApi)

export default api
