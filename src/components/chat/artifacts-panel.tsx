"use client"

import * as React from "react"
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Pin,
  PinOff,
  Search,
  Trash2,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { artifactHref } from "@/lib/artifact-chat-row"
import { artifactsStore } from "@/lib/artifacts-store"
import type { GeneratedArtifact } from "@/lib/chat-types"
import { artifactKindIcon, artifactKindLabel } from "@/lib/artifact-labels"
import { cn } from "@/lib/utils"

export type ChatArtifactItem = {
  /** The artifact_chat row id (used to delete). */
  rowId?: string
  id: string
  kind: GeneratedArtifact["artifact"]["kind"]
  title: string
  createdAt?: string
}

/** A pinned chat message, shown in the Pinned tab. */
export type PinnedMessageItem = {
  id: string
  /** Message text (markdown). */
  text: string
  createdAt?: string
}

export type ChatPanelTab = "pinned" | "artifacts"

type ArtifactsPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tab: ChatPanelTab
  onTabChange: (tab: ChatPanelTab) => void
  artifacts: ChatArtifactItem[]
  /** An artifact was clicked; return true when handled (otherwise it opens). */
  onSelect?: (item: ChatArtifactItem) => boolean
  /** Called when the user presses the trash icon on an item. */
  onDelete?: (item: ChatArtifactItem) => void
  /** Row ids currently mid-delete — used to disable + fade the icon. */
  deleting?: Set<string>
  /** Parent chatbot id — enables the chat-scoped artifact detail URL. */
  chatbotId?: string
  pinned: PinnedMessageItem[]
  /** Scroll the chat to this message. */
  onSelectPinned: (messageId: string) => void
  onUnpin: (messageId: string) => void
  /** Message ids mid-unpin. */
  unpinning?: Set<string>
}

function formatWhen(iso?: string) {
  if (!iso) return null
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso))
  } catch {
    return null
  }
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Markdown → plain text, good enough for a preview line. */
function plainText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[\d+\]/g, "")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** A window of `text` around the first match, so the match is visible. */
function snippetAround(text: string, query: string, radius = 90) {
  const index = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1
  if (index < 0) return text
  const start = Math.max(0, index - radius)
  const end = Math.min(text.length, index + query.length + radius)
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`
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

function EmptyState({ icon: Icon, text }: { icon: typeof Pin; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <Icon className="size-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

/**
 * Right-hand chat panel with two tabs — pinned messages and artifacts —
 * and one search box that filters both.
 */
export function ArtifactsPanel({
  open,
  onOpenChange,
  tab,
  onTabChange,
  artifacts,
  onSelect,
  onDelete,
  deleting,
  chatbotId,
  pinned,
  onSelectPinned,
  onUnpin,
  unpinning,
}: ArtifactsPanelProps) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const q = query.trim()

  const pinnedItems = React.useMemo(
    () =>
      pinned
        .map((item) => ({ ...item, plain: plainText(item.text) }))
        .filter((item) => !q || item.plain.toLowerCase().includes(q.toLowerCase())),
    [pinned, q],
  )

  const artifactItems = React.useMemo(
    () =>
      artifacts.filter((artifact) => {
        if (!q) return true
        const haystack = `${artifact.title} ${artifactKindLabel(artifact.kind)}`
        return haystack.toLowerCase().includes(q.toLowerCase())
      }),
    [artifacts, q],
  )

  const tabs: Array<{ id: ChatPanelTab; label: string; icon: typeof Pin; count: number }> = [
    { id: "pinned", label: "Pinned", icon: Pin, count: pinnedItems.length },
    { id: "artifacts", label: "Artifacts", icon: LayoutGrid, count: artifactItems.length },
  ]

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close side panel" : "Open side panel"}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "fixed top-1/2 z-40 flex h-16 w-5 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 bg-background shadow-md transition-all hover:bg-muted",
          open ? "right-[360px]" : "right-0",
        )}
      >
        {open ? (
          <ChevronRight className="size-4 text-muted-foreground" />
        ) : (
          <ChevronLeft className="size-4 text-muted-foreground" />
        )}
      </button>

      <aside
        aria-label="Pinned messages and artifacts"
        className={cn(
          "fixed inset-y-0 right-0 z-30 flex w-[360px] flex-col border-l bg-background shadow-xl transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
        style={{ top: "3.5rem" }}
      >
        <div role="tablist" aria-label="Side panel" className="flex shrink-0 gap-1 border-b px-2 pt-2">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => onTabChange(id)}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-3 pb-2.5 pt-1.5 text-sm font-medium transition-colors",
                tab === id
                  ? "border-[#f97316] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("size-4", tab === id && "text-[#f97316]")} />
              {label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular-nums",
                  tab === id ? "bg-[#fff7ed] text-[#ea580c]" : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="shrink-0 border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("")
              }}
              placeholder="Search pinned messages and artifacts"
              aria-label="Search pinned messages and artifacts"
              className="h-9 w-full rounded-lg border bg-muted/40 pl-8 pr-8 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-background [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          {tab === "pinned" ? (
            pinnedItems.length === 0 ? (
              <EmptyState
                icon={Pin}
                text={
                  q
                    ? `No pinned messages match “${q}”.`
                    : "Pin an AI reply (hover it and press the pin) to keep it here."
                }
              />
            ) : (
              <ul className="flex flex-col gap-1 p-2">
                {pinnedItems.map((item) => {
                  const when = formatWhen(item.createdAt)
                  const isUnpinning = Boolean(unpinning?.has(item.id))
                  return (
                    <li key={item.id}>
                      <div
                        className={cn(
                          "group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted",
                          isUnpinning && "opacity-50",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectPinned(item.id)}
                          className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        >
                          <Pin className="mt-0.5 size-4 shrink-0 rotate-45 fill-current text-[#f97316]" />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-3 text-sm leading-5">
                              <Highlighted
                                text={snippetAround(item.plain, q) || "(empty message)"}
                                query={q}
                              />
                            </p>
                            {when && (
                              <p className="mt-1 text-[11px] text-muted-foreground/80">{when}</p>
                            )}
                          </div>
                        </button>
                        <button
                          type="button"
                          aria-label="Unpin message"
                          title="Unpin"
                          disabled={isUnpinning}
                          onClick={() => onUnpin(item.id)}
                          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-muted-foreground/10 hover:text-foreground focus-visible:opacity-100 disabled:opacity-40"
                        >
                          <PinOff className="size-3.5" />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )
          ) : artifactItems.length === 0 ? (
            <EmptyState
              icon={LayoutGrid}
              text={
                q
                  ? `No artifacts match “${q}”.`
                  : "Artifacts generated in this chat will appear here."
              }
            />
          ) : (
            <ul className="flex flex-col gap-1 p-2">
              {artifactItems.map((artifact) => {
                const stored = artifactsStore.get(artifact.id)
                const when = formatWhen(stored?.createdAt ?? artifact.createdAt)
                const isDeleting = artifact.rowId
                  ? Boolean(deleting?.has(artifact.rowId))
                  : false

                return (
                  <li key={artifact.rowId ?? artifact.id}>
                    <div
                      className={cn(
                        "group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted",
                        isDeleting && "opacity-50",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (!onSelect?.(artifact)) {
                            router.push(artifactHref(artifact, chatbotId))
                          }
                          onOpenChange(false)
                        }}
                        className="flex flex-1 items-start gap-3 text-left"
                      >
                        <span className="mt-0.5 text-lg" aria-hidden>
                          {artifactKindIcon(artifact.kind)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium leading-5">
                            <Highlighted text={artifact.title} query={q} />
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {artifactKindLabel(artifact.kind)}
                          </p>
                          {when && (
                            <p className="mt-1 text-[11px] text-muted-foreground/80">
                              {when}
                            </p>
                          )}
                        </div>
                      </button>
                      {onDelete && artifact.rowId && (
                        <button
                          type="button"
                          aria-label={`Remove ${artifact.title}`}
                          title="Remove from this chat"
                          disabled={isDeleting}
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(artifact)
                          }}
                          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 focus-visible:opacity-100 disabled:opacity-40"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>

        <div className="shrink-0 border-t p-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Close panel
          </Button>
        </div>
      </aside>
    </>
  )
}

export function collectChatArtifacts(
  messages: Array<{
    artifact?: ChatArtifactItem
  }>,
): ChatArtifactItem[] {
  const seen = new Set<string>()
  const items: ChatArtifactItem[] = []

  for (const message of messages) {
    const artifact = message.artifact
    if (!artifact || seen.has(artifact.id)) continue
    seen.add(artifact.id)
    items.push(artifact)
  }

  return items
}
