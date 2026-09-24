"use client"

import * as React from "react"

import { NotesGrid, type MasonryItem } from "@/components/notes"
import type { NotesboardArtifact } from "@/lib/chat-types"
import { markdownToSlateDocument } from "@/components/slate/lib/markdown-to-slate"

const SHADE_CLASSES = [
  "bg-primary/10",
  "bg-sky-100/80 dark:bg-sky-950/40",
  "bg-amber-100/80 dark:bg-amber-950/40",
  "bg-emerald-100/80 dark:bg-emerald-950/40",
  "bg-violet-100/80 dark:bg-violet-950/40",
  "bg-rose-100/80 dark:bg-rose-950/40",
]

function notesToGridItems(artifact: NotesboardArtifact): MasonryItem[] {
  return artifact.notes.map((note, index) => ({
    id: `note-${index}`,
    label: note.title,
    body: markdownToSlateDocument(note.content),
    shadeClass: SHADE_CLASSES[index % SHADE_CLASSES.length],
    h: Math.min(6, Math.max(4, Math.ceil(note.content.length / 120))),
  }))
}

export function ArtifactNotesboard({
  artifact,
}: {
  artifact: NotesboardArtifact
}) {
  const [items, setItems] = React.useState(() => notesToGridItems(artifact))

  React.useEffect(() => {
    setItems(notesToGridItems(artifact))
  }, [artifact])

  if (artifact.notes.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No notes in this board yet.
      </p>
    )
  }

  return (
    <NotesGrid
      items={items}
      onReorder={setItems}
      initialColumnCount={Math.min(3, Math.max(1, artifact.notes.length))}
      className="min-h-[420px]"
    />
  )
}
