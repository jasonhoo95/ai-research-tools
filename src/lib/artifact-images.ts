"use client"

import { appApi } from "@/lib/api"

export interface StoredImage {
  url: string
  path: string
  createdAt: string | null
}

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"]
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** Images stored per artifact, e.g. folder "bio/<artifactId>". */
export const artifactImages = {
  async list(folder: string): Promise<StoredImage[]> {
    const { data } = await appApi.get<StoredImage[]>("/artifact-images", {
      params: { folder },
    })
    return data
  },

  async upload(folder: string, file: File): Promise<{ url: string; path: string }> {
    const form = new FormData()
    form.append("folder", folder)
    form.append("file", file)
    const { data } = await appApi.post<{ url: string; path: string }>(
      "/artifact-images",
      form,
    )
    return data
  },
}
