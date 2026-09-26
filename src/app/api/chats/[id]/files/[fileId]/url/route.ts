import { NextRequest, NextResponse } from "next/server"

import api, { headersFromIncoming, proxyErrorPayload, proxyValidateStatus } from "@/lib/api"

/** A short-lived signed link to the original document, for the viewer. */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id, fileId } = await ctx.params
  try {
    const upstream = await api.get(`/chats/${id}/files/${fileId}/url`, {
      headers: headersFromIncoming(request.headers),
      validateStatus: proxyValidateStatus,
    })
    return NextResponse.json(upstream.data, { status: upstream.status })
  } catch (error) {
    const { payload, status } = proxyErrorPayload(error, "Failed to reach files service")
    return NextResponse.json(payload, { status })
  }
}
