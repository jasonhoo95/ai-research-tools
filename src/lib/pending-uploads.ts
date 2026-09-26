/**
 * Files picked on /docs for a new workspace, handed to /docs/[id] (which
 * uploads them with progress) across the client-side navigation.
 */
const pending = new Map<string, File[]>()

export function setPendingUploads(chatId: string, files: File[]) {
  pending.set(chatId, files)
}

/** The files waiting for this workspace, removed once taken. */
export function takePendingUploads(chatId: string): File[] {
  const files = pending.get(chatId) ?? []
  pending.delete(chatId)
  return files
}
