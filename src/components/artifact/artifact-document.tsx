"use client"

import * as React from "react"

import type { MessageArtifactResult } from "@/lib/chat-repo"
import { chatRepo } from "@/lib/chat-repo"
import type { Artifact } from "@/lib/chat-types"
import { cn } from "@/lib/utils"

/** Body of a save: the artifact as stored on its chat message. */
export type ArtifactSaveData = { id: string; artifact: Artifact }

export type SaveArtifact = (
  chatId: string,
  rowId: string,
  data: ArtifactSaveData,
) => Promise<unknown>

/** Raw row returned by the message-artifact endpoint. */
type StoredArtifactRow = {
  id: string
  parent_chatbot_id: string
  content?: { id?: string; artifact?: Artifact }
}

type ArtifactDocument = {
  save: SaveArtifact
  title: string
  rename: (title: string) => void
}

const ArtifactDocumentContext = React.createContext<ArtifactDocument | null>(null)

const saveDirect: SaveArtifact = (chatId, rowId, data) =>
  chatRepo.updateMessageArtifact(chatId, rowId, data as never)

/**
 * How an editor saves its artifact. On the artifact page this goes through
 * the page, so title edits and the editor's own edits never overwrite each
 * other (the backend replaces the whole artifact on every save).
 */
export function useSaveArtifact(): SaveArtifact {
  return React.useContext(ArtifactDocumentContext)?.save ?? saveDirect
}

/** The artifact's current title, following renames made on the page. */
export function useArtifactTitle(fallback: string): string {
  return React.useContext(ArtifactDocumentContext)?.title ?? fallback
}

/**
 * Owns the artifact's title on the artifact page and is the single writer to
 * the backend for everything inside it:
 * - every editor save is sent with the current title;
 * - a rename is saved on top of the latest content an editor sent.
 * Editors that edit the title themselves (quiz title, profile name) still
 * work: a title that changed since that editor's previous save is adopted.
 */
export function ArtifactDocumentProvider({
  row,
  artifact,
  children,
}: {
  row: MessageArtifactResult
  artifact: Artifact
  children: React.ReactNode
}) {
  const [title, setTitle] = React.useState(artifact.title)
  const titleRef = React.useRef(artifact.title)
  // Title the editors last sent — unchanged unless an editor renamed it.
  const editorTitleRef = React.useRef(artifact.title)
  const latestRef = React.useRef<ArtifactSaveData | null>(null)

  const send = React.useCallback((chatId: string, rowId: string, data: ArtifactSaveData) => {
    const stamped = { ...data, artifact: { ...data.artifact, title: titleRef.current } }
    latestRef.current = stamped
    return saveDirect(chatId, rowId, stamped)
  }, [])

  const save = React.useCallback<SaveArtifact>(
    (chatId, rowId, data) => {
      const sent = data.artifact.title
      if (sent !== editorTitleRef.current) {
        editorTitleRef.current = sent
        titleRef.current = sent
        setTitle(sent)
      }
      return send(chatId, rowId, data)
    },
    [send],
  )

  const rename = React.useCallback(
    (next: string) => {
      const clean = next.replace(/\s+/g, " ").trim()
      if (!clean || clean === titleRef.current) return
      const previous = titleRef.current
      titleRef.current = clean
      setTitle(clean)

      const stored = row as unknown as StoredArtifactRow
      const base: ArtifactSaveData = latestRef.current ?? {
        id: stored.content?.id ?? stored.id,
        artifact: { ...stored.content?.artifact, ...artifact },
      }
      send(stored.parent_chatbot_id, stored.id, base).catch((err) => {
        console.error("Failed to rename artifact", err)
        if (titleRef.current === clean) {
          titleRef.current = previous
          setTitle(previous)
        }
      })
    },
    [row, artifact, send],
  )

  const value = React.useMemo(() => ({ save, title, rename }), [save, title, rename])

  return (
    <ArtifactDocumentContext.Provider value={value}>{children}</ArtifactDocumentContext.Provider>
  )
}

/**
 * The page heading: reads as a title, click (or Enter) to edit. Enter or
 * clicking away saves, Esc cancels.
 */
export function ArtifactTitle({ className }: { className?: string }) {
  const document = React.useContext(ArtifactDocumentContext)
  const title = document?.title ?? ""
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(title)
  const ref = React.useRef<HTMLTextAreaElement>(null)
  const cancelledRef = React.useRef(false)

  // Grow with the text; titles can wrap.
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!editing || !el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [editing, draft])

  React.useEffect(() => {
    const el = ref.current
    if (!editing || !el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [editing])

  const start = () => {
    if (!document) return
    cancelledRef.current = false
    setDraft(title)
    setEditing(true)
  }

  const finish = () => {
    setEditing(false)
    if (!cancelledRef.current) document?.rename(draft)
  }

  const shared = "-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-0.5 text-3xl font-semibold tracking-tight"

  if (editing) {
    return (
      <textarea
        ref={ref}
        rows={1}
        value={draft}
        aria-label="Title"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault()
            cancelledRef.current = true
            e.currentTarget.blur()
          } else if (e.key === "Enter") {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
        className={cn(
          shared,
          "resize-none overflow-hidden bg-muted/60 ring-2 ring-[#f97316]/40 outline-none",
          className,
        )}
      />
    )
  }

  return (
    <h1
      role={document ? "button" : undefined}
      tabIndex={document ? 0 : undefined}
      title={document ? "Click to rename" : undefined}
      onClick={start}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault()
          start()
        }
      }}
      className={cn(
        shared,
        document &&
          "cursor-text transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-[#f97316]/30 focus-visible:outline-none",
        className,
      )}
    >
      {title || <span className="text-muted-foreground">Untitled</span>}
    </h1>
  )
}
