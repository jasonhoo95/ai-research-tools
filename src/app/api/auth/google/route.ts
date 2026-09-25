import { NextRequest, NextResponse } from "next/server"

import api, { proxyValidateStatus } from "@/lib/api"
import { safeNextPath, setLoginFlowCookies } from "@/lib/auth-session"

/**
 * Start Google login: ask the backend for the Supabase authorize URL, keep
 * the PKCE verifier in an httpOnly cookie, and send the browser to Google.
 */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"))
  const redirectTo = new URL("/auth/callback", request.nextUrl.origin).toString()

  try {
    const upstream = await api.get<{ url: string; codeVerifier: string }>(
      "/auth/google",
      { params: { redirectTo }, validateStatus: proxyValidateStatus },
    )
    if (upstream.status !== 200 || !upstream.data?.url) {
      throw new Error(
        (upstream.data as { message?: string } | undefined)?.message ??
          "Could not start Google login",
      )
    }
    const response = NextResponse.redirect(upstream.data.url)
    setLoginFlowCookies(response, upstream.data.codeVerifier, next)
    return response
  } catch (error) {
    const url = new URL("/login", request.nextUrl.origin)
    url.searchParams.set(
      "error",
      error instanceof Error ? error.message : "Could not start Google login",
    )
    return NextResponse.redirect(url)
  }
}
