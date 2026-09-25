import { NextResponse, type NextRequest } from "next/server"

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  jwtExpiry,
  safeNextPath,
} from "@/lib/auth-session"

/** Pages reachable without a session. */
const PUBLIC_PATHS = ["/login", "/signup", "/auth/callback"]

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))

/**
 * Route guard (Next.js 16 "proxy", formerly middleware). An optimistic
 * cookie check only — the backend verifies the token on every API call.
 *
 * - (app) pages need a live access token, or a refresh token to get one
 *   (the first API call refreshes it); otherwise → /login?next=…
 * - Signed-in users visiting /login or /signup go to the app.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const accessExpiry = jwtExpiry(request.cookies.get(ACCESS_COOKIE)?.value)
  const hasAccess = accessExpiry !== null && accessExpiry > Date.now() / 1000
  const signedIn = hasAccess || Boolean(request.cookies.get(REFRESH_COOKIE)?.value)

  if (isPublic(pathname)) {
    if (signedIn && pathname !== "/auth/callback") {
      const next = safeNextPath(request.nextUrl.searchParams.get("next"))
      return NextResponse.redirect(new URL(next, request.url))
    }
    return NextResponse.next()
  }

  if (!signedIn) {
    const login = new URL("/login", request.url)
    login.searchParams.set("next", `${pathname}${search}`)
    return NextResponse.redirect(login)
  }

  return NextResponse.next()
}

export const config = {
  // Pages only: skip API routes (they return 401 themselves), Next internals
  // and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
}
