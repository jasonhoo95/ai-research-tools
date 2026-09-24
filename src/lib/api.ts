import axios, {
  AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios"

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api"

const TOKEN_STORAGE_KEY = "ai-research-tools.token"

function getToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    }
  } catch {
    // storage disabled — request interceptor will simply skip the header
  }
}

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

/** Forward auth + request id from an incoming Next.js request to the backend. */
export function headersFromIncoming(incoming: Headers): Record<string, string> {
  const auth = incoming.get("authorization")
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
    const token = getToken()
    if (token) {
      config.headers.set?.("Authorization", `Bearer ${token}`)
    }
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
    (error: AxiosError<ApiErrorPayload>) => {
      if (error.response) {
        const { status, data } = error.response
        const payload: ApiErrorPayload =
          data && typeof data === "object"
            ? data
            : { message: error.message || "Request failed" }

        if (status === 401 && typeof window !== "undefined") {
          setAuthToken(null)
        }

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

attachInterceptors(appApi)

export default api
