import { NextRequest, NextResponse } from "next/server"

import api, { headersFromIncoming, proxyErrorPayload, proxyValidateStatus } from "@/lib/api"

/** Pin / unpin a message: `{ pinned }` sets it, an empty body toggles. */
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; messageId: string }> },
) {
  const { id, messageId } = await ctx.params
  try {
    const body = await request.json().catch(() => ({}))
    const upstream = await api.patch(`/chats/${id}/messages/${messageId}/pin`, body, {
      headers: headersFromIncoming(request.headers),
      validateStatus: proxyValidateStatus,
    })
    return NextResponse.json(upstream.data, { status: upstream.status })
  } catch (error) {
    const { payload, status } = proxyErrorPayload(error, "Failed to reach chats service")
    return NextResponse.json(payload, { status })
  }
}
