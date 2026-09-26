"use client"

import * as React from "react"
import { AlertCircle, Loader2, Plus, Trash2, Upload, X } from "lucide-react"

import {
  AttachmentTile,
  attachmentKind,
  attachmentLabel,
  humanBytes,
} from "@/components/chat/attachments"
import type { ChatFileItem } from "@/lib/chat-types"
import { cn } from "@/lib/utils"

/** A file being uploaded, or one that failed. */
export type UploadItem = {
  id: string
  name: string
  size: number
  status: "uploading" | "error"
  error?: string
}

export const DOCUMENT_ACCEPT =
  "application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,text/plain,.txt,.md"

/**
 * The workspace's documents: pick one to preview, add more, remove them.
 * Documents the selected answer used show how many passages it cited.
 */
export function DocumentsPanel({
  files,
  uploads,
  activeFileId,
  referenceCounts,
  onSelect,
  onUpload,
  onDelete,
  onDismissUpload,
  onClose,
}: {
  files: ChatFileItem[]
  uploads: UploadItem[]
  activeFileId: string | null
  /** Passages the selected answer cited, per file id. */
  referenceCounts: ReadonlyMap<string, number>
  onSelect: (fileId: string) => void
  onUpload: (files: File[]) => void
  onDelete: (file: ChatFileItem) => Promise<void>
  onDismissUpload: (id: string) => void
  onClose: () => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const remove = async (file: ChatFileItem) => {
    if (confirmingId !== file.id) {
      setConfirmingId(file.id)
      return
    }
    setDeletingId(file.id)
    try {
      await onDelete(file)
    } finally {
      setDeletingId(null)
      setConfirmingId(null)
    }
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r bg-background">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-3">
        <p className="text-sm font-semibold">
          Documents{" "}
          <span className="font-normal text-muted-foreground tabular-nums">({files.length})</span>
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Plus className="size-3.5" />
            Add
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close documents panel"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={DOCUMENT_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? [])
            e.target.value = ""
            if (picked.length) onUpload(picked)
          }}
        />
      </div>

      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2" aria-label="Documents">
        {files.map((file) => {
          const kind = attachmentKind(file.mimeType, file.name)
          const active = file.id === activeFileId
          const cited = referenceCounts.get(file.id) ?? 0
          return (
            <li key={file.id} className="group/doc relative">
              <button
                type="button"
                onClick={() => onSelect(file.id)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl border p-2 pr-9 text-left transition-colors",
                  active
                    ? "border-[#f97316]/40 bg-[#f97316]/5"
                    : "border-transparent hover:bg-muted",
                )}
              >
                <AttachmentTile kind={kind} className="size-9" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium" title={file.name}>
                    {file.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {attachmentLabel(kind)} · {humanBytes(file.sizeBytes)}
                  </span>
                </span>
                {cited > 0 ? (
                  <span
                    title={`${cited} passage${cited === 1 ? "" : "s"} used in the selected answer`}
                    className="shrink-0 rounded-full bg-[#f97316] px-1.5 text-[10px] leading-4 font-semibold text-white tabular-nums"
                  >
                    {cited}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => void remove(file)}
                onBlur={() => setConfirmingId((id) => (id === file.id ? null : id))}
                disabled={deletingId === file.id}
                aria-label={confirmingId === file.id ? `Confirm removing ${file.name}` : `Remove ${file.name}`}
                title={confirmingId === file.id ? "Click again to remove" : "Remove"}
                className={cn(
                  "absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg transition-[opacity,color,background-color]",
                  confirmingId === file.id
                    ? "bg-red-50 text-red-600 opacity-100"
                    : "text-muted-foreground opacity-0 hover:bg-background hover:text-red-600 group-hover/doc:opacity-100 focus-visible:opacity-100",
                )}
              >
                {deletingId === file.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </button>
            </li>
          )
        })}

        {uploads.map((upload) => (
          <li
            key={upload.id}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border p-2",
              upload.status === "error" ? "border-red-200 bg-red-50" : "border-dashed",
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              {upload.status === "error" ? (
                <AlertCircle className="size-4 text-red-500" />
              ) : (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium" title={upload.name}>
                {upload.name}
              </span>
              <span
                className={cn(
                  "block text-xs",
                  upload.status === "error" ? "text-red-600" : "text-muted-foreground",
                )}
              >
                {upload.status === "error" ? upload.error : "Reading and indexing…"}
              </span>
            </span>
            {upload.status === "error" ? (
              <button
                type="button"
                onClick={() => onDismissUpload(upload.id)}
                aria-label={`Dismiss ${upload.name}`}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-100"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </li>
        ))}

        {files.length === 0 && uploads.length === 0 ? (
          <li className="px-2 py-6 text-center text-sm text-muted-foreground">
            No documents yet.
          </li>
        ) : null}
      </ul>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="m-2 flex shrink-0 flex-col items-center gap-1 rounded-xl border-2 border-dashed px-3 py-4 text-xs text-muted-foreground transition-colors hover:border-[#f97316]/40 hover:bg-[#f97316]/5 hover:text-foreground"
      >
        <Upload className="size-4" />
        Drop or choose PDF / Word files
      </button>
    </aside>
  )
}
