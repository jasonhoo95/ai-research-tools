import { NextRequest, NextResponse } from "next/server"

import api, { headersFromIncoming, proxyErrorPayload, proxyValidateStatus } from "@/lib/api"

/** List images stored for one artifact folder. */
export async function GET(request: NextRequest) {
  try {
    const upstream = await api.get("/artifact-images", {
      params: Object.fromEntries(request.nextUrl.searchParams),
      headers: headersFromIncoming(request.headers),
      validateStatus: proxyValidateStatus,
    })
    return NextResponse.json(upstream.data ?? [], { status: upstream.status })
  } catch (error) {
    const { payload, status } = proxyErrorPayload(error, "Failed to reach image service")
    return NextResponse.json(payload, { status })
  }
}

/** Upload an image (multipart: file, folder). */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const upstream = await api.post("/artifact-images", formData, {
      headers: headersFromIncoming(request.headers),
      validateStatus: proxyValidateStatus,
    })
    return NextResponse.json(upstream.data, { status: upstream.status })
  } catch (error) {
    const { payload, status } = proxyErrorPayload(error, "Failed to reach image service")
    return NextResponse.json(payload, { status })
  }
}
