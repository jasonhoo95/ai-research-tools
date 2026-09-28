"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Highlighter, PanelLeft, Upload, X, ZoomIn, ZoomOut } from "lucide-react"

import { ChatThread, type ChatThreadHandle } from "@/components/chat/chat-thread"
import type { ChatArtifactItem } from "@/components/chat/artifacts-panel"
import { DocumentViewer, ZOOM_LEVELS, stepZoom } from "@/components/docs/document-viewer"
import {
  DOCUMENT_ACCEPT,
  DocumentsPanel,
  type UploadItem,
} from "@/components/docs/documents-panel"
import {
  HighlightSheet,
  InsertHighlightDialog,
  highlightSource,
  type HighlightNote,
} from "@/components/docs/highlight-dialogs"
import type {
  DocHighlight,
  HighlightFocus,
  NewHighlight,
} from "@/components/docs/highlight-layer"
import { buttonVariants } from "@/components/ui/button"
import { ApiError } from "@/lib/api"
import { chatRepo, type ArtifactChatRow, type ChatRow } from "@/lib/chat-repo"
import type { ChatFileItem, GeneratedArtifact, HighlightArtifact } from "@/lib/chat-types"
import { takePendingUploads } from "@/lib/pending-uploads"
import { cn } from "@/lib/utils"

const MAX_FILES = 10
const MAX_FILE_BYTES = 20 * 1024 * 1024

/** Files the workspace accepts: PDF, Word (.docx) and plain text. */
function isDocument(file: File) {
  const name = file.name.toLowerCase()
  return (
    file.type === "application/pdf" ||
    name.endsWith(".pdf") ||
    name.endsWith(".docx") ||
    file.type.startsWith("text/") ||
    name.endsWith(".md") ||
    name.endsWith(".txt")
  )
}

/** Saved highlights among a chat's artifacts. */
function highlightsFrom(rows: ArtifactChatRow[]): DocHighlight[] {
  return rows.flatMap((row) => {
    const artifact = row.content?.artifact
    return artifact?.kind === "highlight" ? [{ id: row.id, artifact }] : []
  })
}

/**
 * A research workspace: upload PDFs and Word documents, preview them, and ask
 * questions across them. Selected text can be kept as a highlight with a note.
 */
export default function DocsWorkspacePage() {
  const params = useParams<{ id: string }>()
  const chatId = params?.id ?? ""

  const [chat, setChat] = React.useState<ChatRow | null>(null)
  const [status, setStatus] = React.useState<"loading" | "ready" | "not-found" | "error">(
    "loading",
  )
  const [files, setFiles] = React.useState<ChatFileItem[]>([])
  const [uploads, setUploads] = React.useState<UploadItem[]>([])
  const [notice, setNotice] = React.useState<string | null>(null)
  const [docsOpen, setDocsOpen] = React.useState(true)
  const [panelOpen, setPanelOpen] = React.useState(false)
  const [activeFileId, setActiveFileId] = React.useState<string | null>(null)
  const [scope, setScope] = React.useState<"all" | "current">("all")
  const [dragging, setDragging] = React.useState(false)
  const [zoom, setZoom] = React.useState(1)

  // Highlights live in the chat's artifacts, which the thread loads and owns.
  const threadRef = React.useRef<ChatThreadHandle>(null)
  const [highlights, setHighlights] = React.useState<DocHighlight[]>([])
  const [focus, setFocus] = React.useState<HighlightFocus | null>(null)
  // Selected text waiting for its title and note.
  const [draft, setDraft] = React.useState<(NewHighlight & { file: ChatFileItem }) | null>(null)
  const [insertOpen, setInsertOpen] = React.useState(false)
  // The sheet's highlight stays set while it slides out.
  const [openHighlightId, setOpenHighlightId] = React.useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)

  const activeFile = files.find((f) => f.id === activeFileId) ?? null

  const uploadDocuments = React.useCallback(
    async (picked: File[]): Promise<string[]> => {
      const rejected = picked.filter((f) => !isDocument(f) || f.size > MAX_FILE_BYTES)
      const accepted = picked.filter((f) => !rejected.includes(f)).slice(0, MAX_FILES)
      const problems = [
        ...rejected.map((f) =>
          isDocument(f)
            ? `${f.name} is larger than 20 MB.`
            : `${f.name} isn't supported — add PDF, Word (.docx) or text files.`,
        ),
        ...(picked.length - rejected.length > MAX_FILES
          ? [`Only ${MAX_FILES} files can be added at a time.`]
          : []),
      ]
      setNotice(problems.length ? problems.join(" ") : null)
      if (!accepted.length) return []

      const pending: UploadItem[] = accepted.map((f) => ({
        id: `upload-${crypto.randomUUID()}`,
        name: f.name,
        size: f.size,
        status: "uploading",
      }))
      const pendingIds = new Set(pending.map((p) => p.id))
      setUploads((prev) => [...prev, ...pending])

      try {
        const results = await chatRepo.uploadFiles(chatId, accepted)
        const added = results.flatMap((r) => (r.file ? [r.file] : []))
        const failed: UploadItem[] = results
          .filter((r) => r.error)
          .map((r, i) => ({
            id: `failed-${crypto.randomUUID()}`,
            name: r.name,
            size: accepted[i]?.size ?? 0,
            status: "error",
            error: r.error,
          }))
        setFiles((prev) => [...prev, ...added])
        setUploads((prev) => [...prev.filter((u) => !pendingIds.has(u.id)), ...failed])
        if (added[0]) setActiveFileId((current) => current ?? added[0].id)
        return added.map((f) => f.id)
      } catch (err) {
        const message =
          err instanceof ApiError || err instanceof Error ? err.message : "Upload failed."
        setUploads((prev) =>
          prev.map((u) => (pendingIds.has(u.id) ? { ...u, status: "error", error: message } : u)),
        )
        return []
      }
    },
    [chatId],
  )

  // Load the workspace, then upload any files picked on /docs.
  React.useEffect(() => {
    if (!chatId) return
    let alive = true
    ;(async () => {
      try {
        const [row, list] = await Promise.all([
          chatRepo.getChat(chatId),
          chatRepo.listFiles(chatId),
        ])
        if (!alive) return
        if (!row) {
          setStatus("not-found")
          return
        }
        setChat(row)
        setFiles(list)
        setActiveFileId(list[0]?.id ?? null)
        setStatus("ready")
        const waiting = takePendingUploads(chatId)
        if (waiting.length) void uploadDocuments(waiting)
      } catch (err) {
        if (!alive) return
        setNotice(err instanceof Error ? err.message : "Could not load this workspace.")
        setStatus("error")
      }
    })()
    return () => {
      alive = false
    }
  }, [chatId, uploadDocuments])

  // Drop documents anywhere on the page.
  React.useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files")
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth += 1
      setDragging(true)
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (!depth) setDragging(false)
    }
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      void uploadDocuments(Array.from(e.dataTransfer?.files ?? []))
    }
    window.addEventListener("dragenter", onEnter)
    window.addEventListener("dragleave", onLeave)
    window.addEventListener("dragover", onOver)
    window.addEventListener("drop", onDrop)
    return () => {
      window.removeEventListener("dragenter", onEnter)
      window.removeEventListener("dragleave", onLeave)
      window.removeEventListener("dragover", onOver)
      window.removeEventListener("drop", onDrop)
    }
  }, [uploadDocuments])

  const onArtifactsChange = React.useCallback(
    (rows: ArtifactChatRow[]) => setHighlights(highlightsFrom(rows)),
    [],
  )

  /** Open the highlight's document, scroll to it, and optionally its sheet. */
  const showHighlight = (id: string, { openSheet = false } = {}) => {
    const highlight = highlights.find((h) => h.id === id)
    if (!highlight) return
    if (!files.some((f) => f.id === highlight.artifact.fileId)) {
      setNotice(`${highlight.artifact.fileName} is no longer in this workspace.`)
      return
    }
    setActiveFileId(highlight.artifact.fileId)
    setFocus({ id, key: Date.now() })
    if (openSheet) {
      setOpenHighlightId(id)
      setSheetOpen(true)
    }
  }

  const selectArtifact = (item: ChatArtifactItem) => {
    if (item.kind !== "highlight" || !item.rowId) return false
    showHighlight(item.rowId, { openSheet: true })
    return true
  }

  const saveHighlight = async ({ title, description }: HighlightNote) => {
    if (!draft) return
    const { file, ...anchor } = draft
    const artifact: HighlightArtifact = {
      kind: "highlight",
      title,
      ...(description ? { description } : {}),
      ...anchor,
      fileId: file.id,
      fileName: file.name,
    }
    const content: GeneratedArtifact = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      prompt: anchor.quote,
      artifact,
    }
    const row = await chatRepo.saveArtifact(chatId, content)
    threadRef.current?.addArtifact(row)
    window.getSelection()?.removeAllRanges()
    setInsertOpen(false)
  }

  const openHighlight = highlights.find((h) => h.id === openHighlightId) ?? null

  const updateHighlight = async ({ title, description }: HighlightNote) => {
    if (!openHighlight) return
    const artifact: HighlightArtifact = { ...openHighlight.artifact, title, description }
    if (!description) delete artifact.description
    const row = await chatRepo.updateArtifact(chatId, openHighlight.id, {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      prompt: artifact.quote,
      artifact,
    })
    threadRef.current?.replaceArtifact(row)
  }

  const deleteHighlight = async () => {
    if (!openHighlight) return
    await chatRepo.deleteArtifact(chatId, openHighlight.id)
    threadRef.current?.removeArtifact(openHighlight.id)
    setSheetOpen(false)
  }

  // Links pasted in a question become documents: show them.
  const refreshFiles = React.useCallback(() => {
    chatRepo
      .listFiles(chatId)
      .then((list) => {
        setFiles(list)
        setActiveFileId((current) => current ?? list.at(-1)?.id ?? null)
      })
      .catch(() => {})
  }, [chatId])

  const deleteDocument = async (file: ChatFileItem) => {
    try {
      await chatRepo.deleteFile(chatId, file.id)
      const next = files.filter((f) => f.id !== file.id)
      setFiles(next)
      if (activeFileId === file.id) setActiveFileId(next[0]?.id ?? null)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not remove the document.")
    }
  }

  const highlightCounts = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const h of highlights) {
      counts.set(h.artifact.fileId, (counts.get(h.artifact.fileId) ?? 0) + 1)
    }
    return counts
  }, [highlights])

  const viewerHighlights = React.useMemo(
    () => highlights.filter((h) => h.artifact.fileId === activeFileId),
    [highlights, activeFileId],
  )

  if (status === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Loading workspace…
      </main>
    )
  }
  if (status === "not-found" || status === "error") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-semibold">
          {status === "not-found" ? "Workspace not found" : "Couldn't open this workspace"}
        </h1>
        {notice ? <p className="max-w-md text-sm text-muted-foreground">{notice}</p> : null}
        <Link href="/docs" className={buttonVariants()}>
          Back to documents
        </Link>
      </main>
    )
  }

  const scopedIds = scope === "current" && activeFile ? [activeFile.id] : undefined

  return (
    <div
      className="flex min-h-0 flex-1 transition-[padding] duration-300"
      style={{ paddingRight: panelOpen ? 360 : 0 }}
    >
      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-foreground/20 bg-background px-12 py-10 text-center shadow-xl">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[#f97316]/10 text-[#f97316]">
              <Upload className="size-7" />
            </span>
            <p className="text-lg font-semibold">Add to {chat?.title ?? "workspace"}</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Drop PDF or Word documents to preview and ask about them.
            </p>
          </div>
        </div>
      ) : null}

      {docsOpen ? (
        <DocumentsPanel
          files={files}
          uploads={uploads}
          activeFileId={activeFileId}
          highlightCounts={highlightCounts}
          onSelect={(id) => {
            setActiveFileId(id)
            setFocus(null)
          }}
          onUpload={(picked) => void uploadDocuments(picked)}
          onDelete={deleteDocument}
          onDismissUpload={(id) => setUploads((prev) => prev.filter((u) => u.id !== id))}
          onClose={() => setDocsOpen(false)}
        />
      ) : null}

      {/* Viewer */}
      <section className="flex min-w-0 flex-1 flex-col border-r bg-background">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          {!docsOpen ? (
            <button
              type="button"
              onClick={() => setDocsOpen(true)}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <PanelLeft className="size-4" />
              Documents
              <span className="rounded-full bg-muted px-1.5 tabular-nums">{files.length}</span>
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" title={activeFile?.name}>
              {activeFile?.name ?? chat?.title}
            </p>
          </div>
          {activeFile?.previewable ? (
            <p className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground lg:flex">
              <Highlighter className="size-3.5" />
              {viewerHighlights.length
                ? `${viewerHighlights.length} highlight${viewerHighlights.length === 1 ? "" : "s"} · select text to add more`
                : "Select text to insert a highlight"}
            </p>
          ) : null}
          {activeFile?.previewable && activeFile.kind !== "image" && activeFile.kind !== "video" ? (
            <div className="flex shrink-0 items-center rounded-lg border bg-background">
              <button
                type="button"
                onClick={() => setZoom((z) => stepZoom(z, -1))}
                disabled={zoom <= ZOOM_LEVELS[0]}
                aria-label="Zoom out"
                title="Zoom out"
                className="flex size-7 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                <ZoomOut className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                title={activeFile.kind === "pdf" ? "Fit to width" : "Reset zoom"}
                className="h-7 min-w-12 border-x px-1.5 text-xs font-medium text-muted-foreground tabular-nums transition-colors hover:bg-muted hover:text-foreground"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => stepZoom(z, 1))}
                disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                aria-label="Zoom in"
                title="Zoom in"
                className="flex size-7 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                <ZoomIn className="size-4" />
              </button>
            </div>
          ) : null}
        </header>
        {notice ? (
          <div className="flex items-start justify-between gap-3 border-b bg-amber-50 px-4 py-2 text-sm text-amber-800">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
              <X className="size-4" />
            </button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1">
          {activeFile ? (
            <DocumentViewer
              chatId={chatId}
              file={activeFile}
              zoom={zoom}
              highlights={viewerHighlights}
              focus={focus}
              onCreateHighlight={(highlight) => {
                setDraft({ ...highlight, file: activeFile })
                setInsertOpen(true)
              }}
              onOpenHighlight={(id) => {
                setOpenHighlightId(id)
                setSheetOpen(true)
              }}
            />
          ) : (
            <EmptyWorkspace uploading={uploads.some((u) => u.status === "uploading")} onFiles={uploadDocuments} />
          )}
        </div>
      </section>

      {/* Questions */}
      <section className="flex w-[min(460px,42%)] min-w-[340px] shrink-0 flex-col">
        <ChatThread
          chatId={chatId}
          variant="docs"
          fileIds={scopedIds}
          onAddDocuments={uploadDocuments}
          handleRef={threadRef}
          onArtifactsChange={onArtifactsChange}
          onArtifactSelect={selectArtifact}
          onLinksSaved={refreshFiles}
          reservePanelSpace={false}
          onPanelOpenChange={setPanelOpen}
          composerPlaceholder={
            files.length ? "Ask about your documents…" : "Add documents, then ask anything…"
          }
          emptyState={
            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Ask anything about your documents</p>
              <p className="mt-1">
                Summaries, comparisons, specific facts. Select text in a document to keep it as a
                highlight with your note.
              </p>
            </div>
          }
          composerAccessory={
            files.length ? (
              <div className="mx-auto mb-2 flex w-full max-w-3xl items-center gap-2 px-1 text-xs text-muted-foreground">
                <span>Ask about</span>
                <div className="flex min-w-0 rounded-lg bg-muted p-0.5">
                  <button
                    type="button"
                    onClick={() => setScope("all")}
                    className={cn(
                      "rounded-md px-2 py-1 whitespace-nowrap transition-colors",
                      scope === "all" ? "bg-background font-medium text-foreground shadow-xs" : "hover:text-foreground",
                    )}
                  >
                    All documents ({files.length})
                  </button>
                  <button
                    type="button"
                    disabled={!activeFile}
                    onClick={() => setScope("current")}
                    title={activeFile?.name}
                    className={cn(
                      "max-w-44 truncate rounded-md px-2 py-1 transition-colors disabled:opacity-50",
                      scope === "current" ? "bg-background font-medium text-foreground shadow-xs" : "hover:text-foreground",
                    )}
                  >
                    {activeFile ? activeFile.name : "This document"}
                  </button>
                </div>
              </div>
            ) : null
          }
        />
      </section>

      <InsertHighlightDialog
        open={insertOpen}
        onOpenChange={setInsertOpen}
        quote={draft?.quote ?? ""}
        source={draft ? highlightSource(draft.file.name, draft.page) : ""}
        onSave={saveHighlight}
      />
      <HighlightSheet
        highlight={openHighlight}
        open={sheetOpen && Boolean(openHighlight)}
        onOpenChange={setSheetOpen}
        onSave={updateHighlight}
        onDelete={deleteHighlight}
        onShow={() => {
          setSheetOpen(false)
          if (openHighlight) showHighlight(openHighlight.id)
        }}
      />
    </div>
  )
}

function EmptyWorkspace({
  uploading,
  onFiles,
}: {
  uploading: boolean
  onFiles: (files: File[]) => Promise<string[]>
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  return (
    <div className="flex h-full items-center justify-center bg-[#f4f4f5] p-8">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex max-w-sm flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-foreground/15 bg-background px-10 py-12 text-center transition-colors hover:border-[#f97316]/40"
      >
        <span className="flex size-14 items-center justify-center rounded-2xl bg-[#f97316]/10 text-[#f97316]">
          <Upload className="size-7" />
        </span>
        <span className="text-lg font-semibold">
          {uploading ? "Reading your documents…" : "Add your first document"}
        </span>
        <span className="text-sm text-muted-foreground">
          Drop PDF or Word files here, or click to choose. Up to {MAX_FILES} at a time, 20 MB each.
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={DOCUMENT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? [])
          e.target.value = ""
          if (picked.length) void onFiles(picked)
        }}
      />
    </div>
  )
}
