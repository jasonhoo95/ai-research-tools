import { NextRequest, NextResponse } from "next/server"

import api, { headersFromIncoming, proxyValidateStatus } from "@/lib/api"
import { clearSessionCookies } from "@/lib/auth-session"

/** Revoke the session on the backend (best effort) and drop the cookies. */
export async function POST(request: NextRequest) {
  try {
    await api.post("/auth/logout", null, {
      headers: headersFromIncoming(request.headers),
      validateStatus: proxyValidateStatus,
    })
  } catch {
    // Signing out locally still works if the backend is unreachable.
  }
  const response = new NextResponse(null, { status: 204 })
  clearSessionCookies(response)
  return response
}
