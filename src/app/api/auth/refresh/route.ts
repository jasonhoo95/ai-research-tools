import { NextRequest, NextResponse } from "next/server"

import api, { proxyValidateStatus } from "@/lib/api"
import {
  REFRESH_COOKIE,
  clearSessionCookies,
  setSessionCookies,
  type AuthSession,
} from "@/lib/auth-session"

/** Swap the refresh-token cookie for a new token pair. */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value
  const unauthorized = (message: string) => {
    const response = NextResponse.json({ message }, { status: 401 })
    clearSessionCookies(response)
    return response
  }
  if (!refreshToken) return unauthorized("Not signed in")

  try {
    const upstream = await api.post<AuthSession>(
      "/auth/refresh",
      { refreshToken },
      { validateStatus: proxyValidateStatus },
    )
    if (upstream.status !== 200 || !upstream.data?.accessToken) {
      return unauthorized("Session expired, please sign in again")
    }
    const response = NextResponse.json({
      expiresAt: upstream.data.expiresAt,
      user: upstream.data.user,
    })
    setSessionCookies(response, upstream.data)
    return response
  } catch {
    // Network trouble isn't a logout — keep the cookies for the next try.
    return NextResponse.json({ message: "Could not reach the server" }, { status: 502 })
  }
}
