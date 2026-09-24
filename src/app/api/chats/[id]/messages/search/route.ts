import { NextRequest, NextResponse } from "next/server"

import api, { headersFromIncoming, proxyErrorPayload, proxyValidateStatus } from "@/lib/api"

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  try {
    const upstream = await api.get(`/chats/${id}/messages/search`, {
      params: Object.fromEntries(request.nextUrl.searchParams),
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
