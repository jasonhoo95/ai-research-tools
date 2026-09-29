import { NextRequest, NextResponse } from "next/server"

import api, { proxyValidateStatus } from "@/lib/api"
import {
  NEXT_COOKIE,
  PKCE_COOKIE,
  clearSessionCookies,
  publicOrigin,
  safeNextPath,
  setSessionCookies,
  type AuthSession,
} from "@/lib/auth-session"

/**
 * Google → Supabase sends the browser here with ?code=. Exchange it (with
 * the PKCE verifier from the login start) for tokens, store them in
 * httpOnly cookies, and continue to the page the user wanted.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const origin = publicOrigin(request)
  const failure = (message: string) => {
    const url = new URL("/login", origin)
    url.searchParams.set("error", message)
    const response = NextResponse.redirect(url)
    clearSessionCookies(response)
    return response
  }

  const providerError = searchParams.get("error_description") ?? searchParams.get("error")
  if (providerError) return failure(providerError)

  const code = searchParams.get("code")
  const codeVerifier = request.cookies.get(PKCE_COOKIE)?.value
  if (!code || !codeVerifier) {
    return failure("Login expired or was started in another browser. Please try again.")
  }

  try {
    const upstream = await api.post<AuthSession>(
      "/auth/callback",
      { code, codeVerifier },
      { validateStatus: proxyValidateStatus },
    )
    if (upstream.status !== 200 || !upstream.data?.accessToken) {
      return failure(
        (upstream.data as { message?: string } | undefined)?.message ??
          "Google login failed. Please try again.",
      )
    }

    const next = safeNextPath(request.cookies.get(NEXT_COOKIE)?.value)
    const response = NextResponse.redirect(new URL(next, origin))
    clearSessionCookies(response)
    setSessionCookies(response, upstream.data)
    return response
  } catch {
    return failure("Could not reach the server. Please try again.")
  }
}
