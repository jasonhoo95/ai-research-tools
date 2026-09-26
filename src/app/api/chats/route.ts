import { NextRequest, NextResponse } from "next/server"

import api, { headersFromIncoming, proxyErrorPayload, proxyValidateStatus } from "@/lib/api"

export async function GET(request: NextRequest) {
  try {
    // Forward ?kind=chat|docs.
    const upstream = await api.get(`/chats${request.nextUrl.search}`, {
      headers: headersFromIncoming(request.headers),
      validateStatus: proxyValidateStatus,
    })

    return NextResponse.json(upstream.data ?? [], { status: upstream.status })
  } catch (error) {
    const { payload, status } = proxyErrorPayload(
      error,
      "Failed to reach chats service",
    )
    return NextResponse.json(payload, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const upstream = await api.post("/chats", body, {
      headers: headersFromIncoming(request.headers),
      validateStatus: proxyValidateStatus,
    })

    return NextResponse.json(upstream.data, { status: upstream.status })
  } catch (error) {
    const { payload, status } = proxyErrorPayload(
      error,
      "Failed to reach chats service",
    )
    return NextResponse.json(payload, { status })
  }
}
