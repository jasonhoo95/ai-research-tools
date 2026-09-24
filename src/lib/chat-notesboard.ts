import { normalizeGeneratedArtifact } from "@/lib/artifact-chat-row"
import type { ArtifactChatRow } from "@/lib/chat-repo"
import type {
  GeneratedArtifact,
  NotesboardArtifact,
  NotesboardNote,
} from "@/lib/chat-types"

export function findChatNotesboard(
  artifacts: ArtifactChatRow[],
): ArtifactChatRow | undefined {
  return artifacts.find((row) => {
    const content = normalizeGeneratedArtifact(row.content)
    return content?.artifact.kind === "notesboard"
  })
}

export function noteTitleFromMarkdown(
  markdown: string,
  role: "user" | "assistant",
): string {
  const firstLine =
    markdown
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? ""

  const stripped = firstLine
    .replace(/^#+\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .trim()

  if (stripped) {
    return stripped.length > 80 ? `${stripped.slice(0, 77)}…` : stripped
  }

  return role === "user" ? "User message" : "Assistant reply"
}

export function messageAlreadyInNotesboard(
  notesboard: GeneratedArtifact | undefined,
  messageId: string,
): boolean {
  if (!notesboard || notesboard.artifact.kind !== "notesboard") return false
  return notesboard.artifact.notes.some(
    (note) => note.sourceMessageId === messageId,
  )
}

export function buildNoteFromMessage(input: {
  messageId: string
  role: "user" | "assistant"
  content: string
}): NotesboardNote {
  return {
    title: noteTitleFromMarkdown(input.content, input.role),
    content: input.content.trim(),
    sourceMessageId: input.messageId,
  }
}

export function createChatNotesboardArtifact(input: {
  chatTitle?: string | null
  note: NotesboardNote
}): GeneratedArtifact {
  const boardTitle = input.chatTitle?.trim()
    ? `${input.chatTitle.trim()} Notes`
    : "Chat Notes"

  const artifact: NotesboardArtifact = {
    kind: "notesboard",
    title: boardTitle,
    notes: [input.note],
  }

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    prompt: "Notes collected from chat messages",
    artifact,
  }
}

export function appendNoteToNotesboard(
  existing: GeneratedArtifact,
  note: NotesboardNote,
): GeneratedArtifact {
  if (existing.artifact.kind !== "notesboard") {
    throw new Error("Expected a notesboard artifact")
  }

  if (
    note.sourceMessageId &&
    existing.artifact.notes.some(
      (entry) => entry.sourceMessageId === note.sourceMessageId,
    )
  ) {
    return existing
  }

  return {
    ...existing,
    artifact: {
      ...existing.artifact,
      notes: [...existing.artifact.notes, note],
    },
  }
}
