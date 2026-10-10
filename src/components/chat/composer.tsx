"use client"

import * as React from "react"
import { ArrowUp, Paperclip, Upload, X } from "lucide-react"

import {
  AttachmentTile,
  attachmentKind,
  attachmentLabel,
  humanBytes,
} from "@/components/chat/attachments"
import { cn } from "@/lib/utils"

/** Files per message, e.g. several reports to compare. */
export const MAX_FILES = 10
/** Gemini receives files inline, so this is for all files together. */
export const MAX_TOTAL_BYTES = 18 * 1024 * 1024

const ACCEPT =
  "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,image/*,video/*,text/*,application/json,.md,.csv"

type PendingFile = { id: string; file: File; previewUrl?: string }

const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`

/** Types the backend can read: PDF, Word (.docx), images, video and text. */
function isSupported(file: File) {
  const kind = attachmentKind(file.type, file.name)
  if (kind === "doc") return file.name.toLowerCase().endsWith(".docx")
  return kind === "pdf" || kind === "image" || kind === "video" || kind === "text"
}

interface Props {
  onSend: (message: string, files: File[]) => void
  pending: boolean
  onFileError?: (message: string) => void
  /** Placeholder when nothing is attached. */
  placeholder?: string
  /** Label of the attach button (e.g. "Add documents"). */
  attachLabel?: string
  /** Accept files dropped anywhere on the page (off when the page handles drops). */
  dropAnywhere?: boolean
}

export function Composer({
  onSend,
  pending,
  onFileError,
  placeholder,
  attachLabel = "Attach files",
  dropAnywhere = true,
}: Props) {
  const [input, setInput] = React.useState("")
  const [files, setFiles] = React.useState<PendingFile[]>([])
  const [dragging, setDragging] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const filesRef = React.useRef(files)

  const canSend = Boolean((input.trim() || files.length) && !pending)

  const resizeTextarea = React.useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [])

  React.useEffect(() => {
    resizeTextarea()
  }, [input, resizeTextarea])

  // Image previews are blob URLs; free them when the composer goes away.
  React.useEffect(() => {
    filesRef.current = files
  }, [files])
  React.useEffect(
    () => () => {
      for (const f of filesRef.current) if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
    },
    [],
  )

  const addFiles = React.useCallback(
    (incoming: File[]) => {
      if (!incoming.length) return
      const current = filesRef.current
      const seen = new Set(current.map((f) => fileKey(f.file)))
      let total = current.reduce((sum, f) => sum + f.file.size, 0)
      const added: PendingFile[] = []
      const problems: string[] = []

      for (const file of incoming) {
        if (seen.has(fileKey(file))) continue
        if (!isSupported(file)) {
          problems.push(`${file.name} isn't supported. Attach PDF, Word (.docx), image, video or text files.`)
          continue
        }
        if (current.length + added.length >= MAX_FILES) {
          problems.push(`You can attach up to ${MAX_FILES} files per message.`)
          break
        }
        if (total + file.size > MAX_TOTAL_BYTES) {
          problems.push(
            `${file.name} is too large: files can add up to ${humanBytes(MAX_TOTAL_BYTES)} per message.`,
          )
          continue
        }
        seen.add(fileKey(file))
        total += file.size
        added.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
        })
      }

      if (added.length) {
        const next = [...current, ...added]
        filesRef.current = next
        setFiles(next)
      }
      if (problems.length) onFileError?.([...new Set(problems)].join(" "))
    },
    [onFileError],
  )

  const removeFile = (id: string) => {
    const target = filesRef.current.find((f) => f.id === id)
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
    const next = filesRef.current.filter((f) => f.id !== id)
    filesRef.current = next
    setFiles(next)
  }

  const submit = () => {
    if (!canSend) return
    onSend(
      input,
      files.map((f) => f.file),
    )
    for (const f of files) if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
    filesRef.current = []
    setInput("")
    setFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ""
    requestAnimationFrame(resizeTextarea)
  }

  // Drop files anywhere on the page, like ChatGPT.
  React.useEffect(() => {
    if (pending || !dropAnywhere) return
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
      if (depth === 0) setDragging(false)
    }
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      addFiles(Array.from(e.dataTransfer?.files ?? []))
      textareaRef.current?.focus()
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
  }, [pending, addFiles, dropAnywhere])

  const totalBytes = files.reduce((sum, f) => sum + f.file.size, 0)

  return (
    <div className="mx-auto w-full max-w-3xl px-1">
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-foreground/20 bg-background px-12 py-10 text-center shadow-xl">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[#f97316]/10 text-[#f97316]">
              <Upload className="size-7" />
            </span>
            <p className="text-lg font-semibold">Add files</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Drop PDFs, Word documents, images, videos or text files — up to {MAX_FILES} at once
              to compare or extract from.
            </p>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="relative"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []))
            // Allow picking the same file again after removing it.
            e.target.value = ""
          }}
        />

        <div
          className={cn(
            "flex flex-col rounded-[26px] border bg-background px-2 py-2 shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-shadow",
            "focus-within:border-foreground/15 focus-within:shadow-[0_2px_18px_rgba(0,0,0,0.08)]",
            "dark:border-border/80 dark:bg-muted/20 dark:shadow-[0_2px_16px_rgba(0,0,0,0.35)]",
          )}
        >
          {files.length > 0 && (
            <div className="px-1 pb-1">
              <ul
                aria-label="Attached files"
                // Top/right padding leaves room for the remove buttons.
                className="flex gap-2 overflow-x-auto pt-2 pr-2 pb-1"
              >
                {files.map(({ id, file, previewUrl }) => {
                  const kind = attachmentKind(file.type, file.name)
                  return (
                    <li
                      key={id}
                      className="group/file relative flex w-60 shrink-0 items-center gap-2.5 rounded-xl border bg-muted/40 p-2 pr-3"
                    >
                      <AttachmentTile kind={kind} previewUrl={previewUrl} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium" title={file.name}>
                          {file.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {attachmentLabel(kind)} · {humanBytes(file.size)}
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => removeFile(id)}
                        className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-foreground text-background opacity-0 shadow transition-opacity group-hover/file:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                      >
                        <X className="size-3" strokeWidth={3} />
                      </button>
                    </li>
                  )
                })}
              </ul>
              {files.length > 1 && (
                <p className="px-1 text-xs text-muted-foreground">
                  {files.length} files · {humanBytes(totalBytes)} of {humanBytes(MAX_TOTAL_BYTES)}
                </p>
              )}
            </div>
          )}

          <div className="flex items-end gap-1">
            <button
              type="button"
              disabled={pending || files.length >= MAX_FILES}
              onClick={() => fileInputRef.current?.click()}
              title={files.length >= MAX_FILES ? `Up to ${MAX_FILES} files` : attachLabel}
              aria-label={attachLabel}
              className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <Paperclip className="size-[18px]" />
            </button>

            <textarea
              ref={textareaRef}
              data-tour="artifact-prompt"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              onPaste={(e) => {
                const pasted = Array.from(e.clipboardData.files)
                if (!pasted.length) return
                e.preventDefault()
                addFiles(pasted)
              }}
              rows={1}
              placeholder={
                files.length > 1
                  ? "Compare, extract or summarise these files…"
                  : files.length === 1
                    ? "Ask about this file…"
                    : (placeholder ?? "Type @ to select or ask anything!")
              }
              disabled={pending}
              className={cn(
                "max-h-[200px] min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 outline-none",
                "placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-60",
              )}
            />

            <button
              type="submit"
              disabled={!canSend}
              aria-label={pending ? "Sending message" : "Send message"}
              className={cn(
                "mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full transition-all",
                canSend
                  ? "bg-foreground text-background hover:opacity-90"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
              )}
            >
              <ArrowUp className="size-[18px]" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </form>

      <p className="mt-2 text-center text-xs text-muted-foreground/80">
        Gemini can make mistakes. Check important info.
      </p>
    </div>
  )
}
