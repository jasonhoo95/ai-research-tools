import type { GeneratedArtifact } from "@/lib/chat-types"

const KEY = "ai-research-tools.artifacts"
const MAX_ITEMS = 50

function safeParse(raw: string | null): GeneratedArtifact[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as GeneratedArtifact[]
  } catch {
    return []
  }
}

function readAll(): GeneratedArtifact[] {
  if (typeof window === "undefined") return []
  try {
    return safeParse(window.localStorage.getItem(KEY))
  } catch {
    return []
  }
}

function writeAll(items: GeneratedArtifact[]) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch {
    // storage disabled — silently drop
  }
}

export const artifactsStore = {
  save(item: GeneratedArtifact) {
    const existing = readAll().filter((a) => a.id !== item.id)
    writeAll([item, ...existing])
  },

  get(id: string): GeneratedArtifact | undefined {
    return readAll().find((a) => a.id === id)
  },

  list(): GeneratedArtifact[] {
    return readAll()
  },

  remove(id: string) {
    writeAll(readAll().filter((a) => a.id !== id))
  },
}
