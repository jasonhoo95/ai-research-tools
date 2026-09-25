import type { NextResponse } from "next/server"

/**
 * Session cookies. Tokens live in httpOnly cookies so page scripts can't read
 * them; the Next.js `/api` routes forward the access token to the backend as
 * `Authorization: Bearer …` (see `headersFromIncoming` in `api.ts`).
 */
export const ACCESS_COOKIE = "art_access_token"
export const REFRESH_COOKIE = "art_refresh_token"
/** PKCE verifier for an in-flight Google login. */
export const PKCE_COOKIE = "art_pkce_verifier"
/** Where to go after login. */
export const NEXT_COOKIE = "art_after_login"

const REFRESH_MAX_AGE = 60 * 60 * 24 * 30 // 30 days
const LOGIN_FLOW_MAX_AGE = 60 * 10 // 10 minutes

export interface AuthUser {
  id: string
  email?: string
  name?: string
  avatarUrl?: string
}

/** Token pair from the backend's /auth/callback and /auth/refresh. */
export interface AuthSession {
  accessToken: string
  refreshToken: string
  /** Unix seconds. */
  expiresAt: number
  expiresIn: number
  user: AuthUser
}

const secure = process.env.NODE_ENV === "production"

function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge }
}

export function setSessionCookies(response: NextResponse, session: AuthSession) {
  // The access cookie expires with the token, so an expired token simply
  // stops being sent and the next API call refreshes it.
  const accessMaxAge = Math.max(
    1,
    Math.min(session.expiresIn, session.expiresAt - Math.floor(Date.now() / 1000)),
  )
  response.cookies.set(ACCESS_COOKIE, session.accessToken, cookieOptions(accessMaxAge))
  response.cookies.set(REFRESH_COOKIE, session.refreshToken, cookieOptions(REFRESH_MAX_AGE))
}

export function clearSessionCookies(response: NextResponse) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, PKCE_COOKIE, NEXT_COOKIE]) {
    response.cookies.set(name, "", cookieOptions(0))
  }
}

export function setLoginFlowCookies(
  response: NextResponse,
  codeVerifier: string,
  next: string,
) {
  response.cookies.set(PKCE_COOKIE, codeVerifier, cookieOptions(LOGIN_FLOW_MAX_AGE))
  response.cookies.set(NEXT_COOKIE, next, cookieOptions(LOGIN_FLOW_MAX_AGE))
}

/**
 * `exp` (unix seconds) from a JWT without verifying it. Only for optimistic
 * checks — the backend verifies every token.
 */
export function jwtExpiry(token: string | undefined): number | null {
  const payload = token?.split(".")[1]
  if (!payload) return null
  try {
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: unknown }
    return typeof json.exp === "number" ? json.exp : null
  } catch {
    return null
  }
}

/** Only allow same-site paths as a post-login destination (no open redirect). */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/dashboard"
  }
  return value
}

/** Read one cookie from a raw `Cookie` header. */
export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(";")) {
    const index = part.indexOf("=")
    if (index === -1) continue
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim())
    }
  }
  return undefined
}
