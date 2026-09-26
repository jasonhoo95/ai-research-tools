import { NextRequest, NextResponse } from "next/server"

import api, { headersFromIncoming, proxyErrorPayload, proxyValidateStatus } from "@/lib/api"

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id, fileId } = await ctx.params
  try {
    const upstream = await api.delete(`/chats/${id}/files/${fileId}`, {
      headers: headersFromIncoming(request.headers),
      validateStatus: proxyValidateStatus,
    })
    if (upstream.status === 204) return new NextResponse(null, { status: 204 })
    return NextResponse.json(upstream.data, { status: upstream.status })
  } catch (error) {
    const { payload, status } = proxyErrorPayload(error, "Failed to reach files service")
    return NextResponse.json(payload, { status })
  }
}
