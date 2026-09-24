"use client"

import * as React from "react"
import type { Descendant } from "slate"

import { NotesGrid, type MasonryItem } from "@/components/notes"
import type { NotesboardArtifact, NotesboardNote } from "@/lib/chat-types"
import { markdownToSlateDocument } from "@/components/slate/lib/markdown-to-slate"
import type { MessageArtifactResult } from "@/lib/chat-repo"
import { chatRepo } from "@/lib/chat-repo"

const SAVE_DELAY_MS = 600

const SHADE_CLASSES = [
  "bg-primary/10",
  "bg-sky-100/80 dark:bg-sky-950/40",
  "bg-amber-100/80 dark:bg-amber-950/40",
  "bg-emerald-100/80 dark:bg-emerald-950/40",
  "bg-violet-100/80 dark:bg-violet-950/40",
  "bg-rose-100/80 dark:bg-rose-950/40",
]

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

    chatRepo
      .updateMessageArtifact(
        row.parent_chatbot_id,
        row.id,
        artifactData as never,
      )
      .catch((err) => {
        lastSavedRef.current = null
        console.error("Failed to save notesboard", err)
      })
  }, [data])

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
      initialColumnCount={
        artifact.columnCount ?? Math.min(3, Math.max(1, artifact.notes.length))
      }
      className="min-h-[420px]"
    />
  )
}
