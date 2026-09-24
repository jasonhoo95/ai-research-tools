import { NextRequest, NextResponse } from "next/server"

import api, { headersFromIncoming, proxyErrorPayload, proxyValidateStatus } from "@/lib/api"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const upstream = await api.post("/chat/file", formData, {
      headers: headersFromIncoming(request.headers),
      validateStatus: proxyValidateStatus,
    })

    return NextResponse.json(upstream.data, { status: upstream.status })
  } catch (error) {
    const { payload, status } = proxyErrorPayload(
      error,
      "Failed to reach chat service",
    )
    return NextResponse.json(payload, { status })
  }
}
