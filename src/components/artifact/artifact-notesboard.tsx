"use client"

import * as React from "react"
import type { Descendant } from "slate"

import { NotesGrid, type MasonryItem } from "@/components/notes"
import type { NotesboardArtifact, NotesboardNote } from "@/lib/chat-types"
import { markdownToSlateDocument } from "@/components/slate/lib/markdown-to-slate"
import type { MessageArtifactResult } from "@/lib/chat-repo"
import { useSaveArtifact } from "@/components/artifact/artifact-document"

const SAVE_DELAY_MS = 600

// Sticky-note palette: paper colour, the darker folded corner, and ink.
const SHADE_CLASSES = [
  "[--note-bg:#d4eff1] [--note-fold-bg:#9fd3d9] [--note-ink:#1f3136] dark:[--note-bg:#1d3a3e] dark:[--note-fold-bg:#2c585e] dark:[--note-ink:#e3f4f5]",
  "[--note-bg:#fdf0b5] [--note-fold-bg:#ecd373] [--note-ink:#3a3212] dark:[--note-bg:#3d3515] dark:[--note-fold-bg:#5e5220] dark:[--note-ink:#f8efc6]",
  "[--note-bg:#fbdde6] [--note-fold-bg:#eeafc2] [--note-ink:#3d1f29] dark:[--note-bg:#40222c] dark:[--note-fold-bg:#633543] dark:[--note-ink:#fbe3ea]",
  "[--note-bg:#dcf2d6] [--note-fold-bg:#a9d99e] [--note-ink:#1f3319] dark:[--note-bg:#223a1d] dark:[--note-fold-bg:#35592e] dark:[--note-ink:#e2f4dd]",
  "[--note-bg:#e6defb] [--note-fold-bg:#c1b0ef] [--note-ink:#2a2140] dark:[--note-bg:#2d2545] dark:[--note-fold-bg:#463a6b] dark:[--note-ink:#ece6fc]",
  "[--note-bg:#fde3cc] [--note-fold-bg:#f1bb8e] [--note-ink:#3d2512] dark:[--note-bg:#40291a] dark:[--note-fold-bg:#633f27] dark:[--note-ink:#fce8d7]",
].map((colors) => `[--note-fold:26px] ${colors}`)

/** Raw chatbot_message row returned by the message-artifact endpoint. */
type StoredArtifactRow = {
  id: string
  parent_chatbot_id: string
  content: { id: string; artifact: NotesboardArtifact }
}

function noteId(index: number) {
  return `note-${index}`
}

function noteBody(content: NotesboardNote["content"]): Descendant[] {
  return Array.isArray(content) ? content : markdownToSlateDocument(content)
}

function notesToGridItems(artifact: NotesboardArtifact): MasonryItem[] {
  return artifact.notes.map((note, index) => ({
    id: noteId(index),
    label: note.title,
    body: noteBody(note.content),
    shadeClass: SHADE_CLASSES[index % SHADE_CLASSES.length],
    x: note.x,
    y: note.y,
    w: note.w,
    h:
      note.h ??
      (typeof note.content === "string"
        ? Math.min(6, Math.max(4, Math.ceil(note.content.length / 120)))
        : undefined),
  }))
}

export function ArtifactNotesboard({
  data,
  artifact,
}: {
  data: MessageArtifactResult
  artifact: NotesboardArtifact
}) {
  const [items, setItems] = React.useState(() => notesToGridItems(artifact))
  const itemsRef = React.useRef(items)
  const columnCountRef = React.useRef(artifact.columnCount)
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    const next = notesToGridItems(artifact)
    itemsRef.current = next
    columnCountRef.current = artifact.columnCount
    setItems(next)
  }, [artifact])

  const saveArtifact = useSaveArtifact()

  const saveNow = React.useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    const row = data as unknown as StoredArtifactRow
    const originalNotes = new Map(
      row.content.artifact.notes.map((note, index) => [noteId(index), note]),
    )

    const notes: NotesboardNote[] = itemsRef.current.map((item) => ({
      ...originalNotes.get(item.id),
      title: item.label ?? "",
      content: item.body ?? [],
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    }))

    const artifactData = {
      id: row.content.id,
      artifact: {
        ...row.content.artifact,
        ...(columnCountRef.current !== undefined && {
          columnCount: columnCountRef.current,
        }),
        notes,
      },
    }

    const serialized = JSON.stringify(artifactData)
    if (serialized === lastSavedRef.current) return
    lastSavedRef.current = serialized

    saveArtifact(
        row.parent_chatbot_id,
        row.id,
        artifactData as never,
      )
      .catch((err) => {
        lastSavedRef.current = null
        console.error("Failed to save notesboard", err)
      })
  }, [data, saveArtifact])

  const scheduleSave = React.useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(saveNow, SAVE_DELAY_MS)
  }, [saveNow])

  // Flush any pending edit when leaving the page.
  React.useEffect(
    () => () => {
      if (saveTimerRef.current) saveNow()
    },
    [saveNow],
  )

  const handleReorder = React.useCallback((next: MasonryItem[]) => {
    itemsRef.current = next
    setItems(next)
  }, [])

  const handleLayoutCommit = React.useCallback(
    (next: MasonryItem[]) => {
      handleReorder(next)
      scheduleSave()
    },
    [handleReorder, scheduleSave],
  )

  const handleItemChange = React.useCallback(
    (id: string, patch: Pick<MasonryItem, "label" | "body">) => {
      handleReorder(
        itemsRef.current.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      )
      scheduleSave()
    },
    [handleReorder, scheduleSave],
  )

  const handleAddNote = React.useCallback(() => {
    const index = itemsRef.current.length
    handleReorder([
      ...itemsRef.current,
      {
        id: `note-new-${crypto.randomUUID()}`,
        label: "Untitled note",
        body: [{ type: "paragraph", children: [{ text: "" }] }],
        shadeClass: SHADE_CLASSES[index % SHADE_CLASSES.length],
        h: 4,
      },
    ])
    scheduleSave()
  }, [handleReorder, scheduleSave])

  const handleRemoveNote = React.useCallback(
    (id: string) => {
      handleReorder(itemsRef.current.filter((item) => item.id !== id))
      scheduleSave()
    },
    [handleReorder, scheduleSave],
  )

  const handleColumnsChange = React.useCallback(
    (count: number) => {
      columnCountRef.current = count
      scheduleSave()
    },
    [scheduleSave],
  )

  return (
    <NotesGrid
      items={items}
      onReorder={handleReorder}
      onLayoutCommit={handleLayoutCommit}
      onItemChange={handleItemChange}
      onColumnsChange={handleColumnsChange}
      onAddItem={handleAddNote}
      onRemoveItem={handleRemoveNote}
      initialColumnCount={
        artifact.columnCount ?? Math.min(3, Math.max(1, artifact.notes.length))
      }
      className="min-h-[420px]"
    />
  )
}
