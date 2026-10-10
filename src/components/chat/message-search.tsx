"use client"

import * as React from "react"
import { Loader2, Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { chatRepo, type MessageSearchHit } from "@/lib/chat-repo"
import { cn } from "@/lib/utils"
import { formatDayLabel } from "@/components/chat/date-separator"

const DEBOUNCE_MS = 300

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, "gi"))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="rounded-sm bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-500/40"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  )
}

/**
 * Search icon that expands into a panel listing matching messages in this
 * chat (searched server-side). Picking a result calls `onSelect` so the
 * page can load and scroll to that message.
 */
export function MessageSearch({
  chatId,
  onSelect,
}: {
  chatId: string
  onSelect: (messageId: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [hits, setHits] = React.useState<MessageSearchHit[]>([])
  const [nextCursor, setNextCursor] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const requestRef = React.useRef(0)
  const rootRef = React.useRef<HTMLDivElement>(null)

  const trimmed = query.trim()

  const run = React.useCallback(
    async (q: string, cursor?: string) => {
      const requestId = ++requestRef.current
      setLoading(true)
      setError(null)
      try {
        const page = await chatRepo.searchMessages(chatId, { q, cursor })
        if (requestId !== requestRef.current) return
        setHits((prev) => (cursor ? [...prev, ...page.items] : page.items))
        setNextCursor(page.nextCursor)
      } catch (err) {
        if (requestId !== requestRef.current) return
        setError((err as Error).message)
      } finally {
        if (requestId === requestRef.current) setLoading(false)
      }
    },
    [chatId],
  )

  React.useEffect(() => {
    if (!trimmed) {
      requestRef.current++
      setHits([])
      setNextCursor(null)
      setLoading(false)
      return
    }
    const t = setTimeout(() => run(trimmed), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [trimmed, run])

  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        data-tour="search-message"
        aria-label="Search messages"
        title="Search messages"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex size-9 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground",
          open && "bg-muted text-foreground",
        )}
      >
        <Search className="size-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 flex max-h-[70vh] w-[min(380px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center gap-2 border-b p-2">
            <Search className="ml-1 size-4 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search this chat"
              className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            {loading ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto">
            {error && (
              <p className="px-4 py-6 text-center text-sm text-red-600">{error}</p>
            )}
            {!error && trimmed && !loading && hits.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No messages match “{trimmed}”.
              </p>
            )}
            {!trimmed && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Type to search messages in this chat.
              </p>
            )}
            {hits.length > 0 && (
              <ul className="flex flex-col p-1">
                {hits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(hit.id)
                        setOpen(false)
                      }}
                      className="flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left hover:bg-muted"
                    >
                      <span className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-medium">
                          {hit.role === "user" ? "You" : "Assistant"}
                        </span>
                        <span>{formatDayLabel(hit.created_at)}</span>
                      </span>
                      <span className="line-clamp-2 text-sm">
                        <Highlighted text={hit.snippet} query={trimmed} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {nextCursor && (
              <button
                type="button"
                disabled={loading}
                onClick={() => run(trimmed, nextCursor)}
                className="w-full border-t px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
              >
                {loading ? "Loading…" : "Load more results"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
