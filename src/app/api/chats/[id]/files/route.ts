import { NextRequest, NextResponse } from "next/server"

import api, { headersFromIncoming, proxyErrorPayload, proxyValidateStatus } from "@/lib/api"

type Ctx = { params: Promise<{ id: string }> }

/** Documents in a chat. */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const upstream = await api.get(`/chats/${id}/files`, {
      headers: headersFromIncoming(request.headers),
      validateStatus: proxyValidateStatus,
    })
    return NextResponse.json(upstream.data ?? [], { status: upstream.status })
  } catch (error) {
    const { payload, status } = proxyErrorPayload(error, "Failed to reach files service")
    return NextResponse.json(payload, { status })
  }
}

/** Upload and index documents (multipart "files"). */
export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  try {
    const formData = await request.formData()
    const upstream = await api.post(`/chats/${id}/files`, formData, {
      headers: headersFromIncoming(request.headers),
      validateStatus: proxyValidateStatus,
      // Extraction and embedding of several documents can take a while.
      timeout: 5 * 60_000,
    })
    return NextResponse.json(upstream.data, { status: upstream.status })
  } catch (error) {
    const { payload, status } = proxyErrorPayload(error, "Failed to reach files service")
    return NextResponse.json(payload, { status })
  }
}
