import type { ArtifactKind } from "@/lib/chat-types"

export function artifactKindLabel(kind: ArtifactKind): string {
  switch (kind) {
    case "chart":
      return "Chart"
    case "table":
      return "Table"
    case "slide":
      return "Slide deck"
    case "notesboard":
      return "Notes board"
    case "notes":
      return "Note"
  }
}

export function artifactKindIcon(kind: ArtifactKind): string {
  switch (kind) {
    case "chart":
      return "📊"
    case "table":
      return "🧾"
    case "slide":
      return "🖼️"
    case "notesboard":
      return "📝"
    case "notes":
      return "📌"
  }
}
