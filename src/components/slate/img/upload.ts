"use client"

import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  artifactImages,
} from "@/lib/artifact-images"

/** Open the OS file picker for one image; resolves null when cancelled. */
export function chooseImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ACCEPTED_IMAGE_TYPES.join(",")
    input.onchange = () => resolve(input.files?.[0] ?? null)
    // Fires when the dialog closes without a selection (modern browsers).
    input.addEventListener("cancel", () => resolve(null))
    input.click()
  })
}

/** Throws a user-facing message when the file can't be uploaded. */
export function validateImageFile(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Choose a PNG, JPEG or WebP image.")
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Images must be 5 MB or smaller.")
  }
}

/** Upload an editor image and return its public URL. */
export async function uploadEditorImage(file: File): Promise<string> {
  validateImageFile(file)
  // Each upload gets its own folder; editor images aren't tied to an artifact.
  const { url } = await artifactImages.upload(`editor/${crypto.randomUUID()}`, file)
  return url
}
