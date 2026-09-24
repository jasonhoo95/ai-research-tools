"use client"

import * as React from "react"
import { ArrowUp, Paperclip, X } from "lucide-react"

import { cn } from "@/lib/utils"

function humanBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

interface Props {
  onSend: (message: string, file: File | null) => void
  pending: boolean
  onFileError?: (message: string) => void
}

export function Composer({ onSend, pending, onFileError }: Props) {
  const [input, setInput] = React.useState("")
  const [pendingFile, setPendingFile] = React.useState<File | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const canSend = Boolean((input.trim() || pendingFile) && !pending)

  const resizeTextarea = React.useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [])

  React.useEffect(() => {
    resizeTextarea()
  }, [input, resizeTextarea])

  const submit = () => {
    if (!canSend) return
    onSend(input, pendingFile)
    setInput("")
    setPendingFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    requestAnimationFrame(resizeTextarea)
  }

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    if (f && f.size > 20 * 1024 * 1024) {
      onFileError?.("File too large. Max 20 MB.")
      e.target.value = ""
      return
    }
    setPendingFile(f)
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-1">
      {pendingFile && (
        <div className="mb-2 flex items-center gap-2">
          <div className="inline-flex max-w-full items-center gap-2 rounded-full border bg-muted/60 py-1.5 pr-1.5 pl-3 text-sm">
            <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{pendingFile.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {humanBytes(pendingFile.size)}
            </span>
            <button
              type="button"
              aria-label="Remove attachment"
              onClick={() => {
                setPendingFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ""
              }}
              className="ml-1 flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
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
          accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*,video/*,text/*"
          className="hidden"
          onChange={onPickFile}
        />

        <div
          className={cn(
            "flex items-end gap-1 rounded-[26px] border bg-background px-2 py-2 shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-shadow",
            "focus-within:border-foreground/15 focus-within:shadow-[0_2px_18px_rgba(0,0,0,0.08)]",
            "dark:border-border/80 dark:bg-muted/20 dark:shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
          )}
        >
          <button
            type="button"
            disabled={pending}
            onClick={() => fileInputRef.current?.click()}
            title="Attach a file"
            aria-label="Attach a file"
            className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <Paperclip className="size-[18px]" />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            rows={1}
            placeholder={
              pendingFile
                ? "Ask about this file…"
                : "Type @ to select or ask anything!"
            }
            disabled={pending}
            className={cn(
              "max-h-[200px] min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 outline-none",
              "placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-60"
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
                : "cursor-not-allowed bg-muted text-muted-foreground"
            )}
          >
            <ArrowUp className="size-[18px]" strokeWidth={2.5} />
          </button>
        </div>
      </form>

      <p className="mt-2 text-center text-xs text-muted-foreground/80">
        Gemini can make mistakes. Check important info.
      </p>
    </div>
  )
}
