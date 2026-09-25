import { NextRequest, NextResponse } from "next/server"

import api, { headersFromIncoming, proxyErrorPayload, proxyValidateStatus } from "@/lib/api"

/** The signed-in user (from the access-token cookie). */
export async function GET(request: NextRequest) {
  try {
    const upstream = await api.get("/auth/me", {
      headers: headersFromIncoming(request.headers),
      validateStatus: proxyValidateStatus,
    })
    return NextResponse.json(upstream.data, { status: upstream.status })
  } catch (error) {
    const { payload, status } = proxyErrorPayload(error, "Failed to load user")
    return NextResponse.json(payload, { status })
  }
}
