"use client"

import Link from "next/link"
import { Bookmark, BookmarkCheck, StickyNote } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Markdown } from "@/components/markdown"
import { cn } from "@/lib/utils"
import type {
  CitationSource,
  GeneratedArtifact,
  SearchProvider,
} from "@/lib/chat-types"
import { artifactKindIcon, artifactKindLabel } from "@/lib/artifact-labels"
import { Citations, linkifyCitations } from "@/components/chat/citations"

export type MessageRole = "user" | "assistant"

export interface ChatBubbleMessage {
  id: string
  role: MessageRole
  content: string
  attachment?: { name: string; kind: string }
  artifact?: {
    id: string
    kind: GeneratedArtifact["artifact"]["kind"]
    title: string
  }
  sources?: CitationSource[]
  searchProvider?: SearchProvider
  /** ISO timestamp — drives the day separators in the message list. */
  createdAt?: string
}

export interface ArtifactSaveState {
  saved: boolean
  saving: boolean
  onSave: () => void
}

export interface MessageNoteState {
  saved: boolean
  saving: boolean
  onAdd: () => void
}

export function MessageBubble({
  message,
  typing,
  artifactSaveState,
  noteState,
  chatbotId,
}: {
  message: ChatBubbleMessage
  typing?: boolean
  /** When present, the artifact card renders a save/pin button. */
  artifactSaveState?: ArtifactSaveState
  /** When present, renders an add-to-notes button on the bubble. */
  noteState?: MessageNoteState
  /** Parent chatbot id, used to build the artifact detail URL. */
  chatbotId?: string
}) {
  const isUser = message.role === "user"
  const showAddNotes =
    noteState && !typing && message.content.trim().length > 0

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn(isUser ? "bg-primary text-primary-foreground" : "bg-muted")}
        >
          {isUser ? "U" : "AI"}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          "relative max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-6",
          isUser
            ? "bg-primary text-primary-foreground whitespace-pre-wrap"
            : "bg-muted text-foreground",
        )}
      >
        {typing ? (
          <TypingDots />
        ) : (
          <>
            {message.attachment && (
              <div
                className={cn(
                  "mb-2 rounded-md px-2 py-1 text-xs",
                  isUser
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "bg-background/50 text-muted-foreground",
                )}
              >
                📎 {message.attachment.name}
              </div>
            )}
            {isUser ? (
              message.content
            ) : (
              <Markdown>
                {message.sources?.length
                  ? linkifyCitations(message.content, message.sources)
                  : message.content}
              </Markdown>
            )}
            {message.artifact && (
              <ArtifactCard
                artifact={message.artifact}
                saveState={artifactSaveState}
                chatbotId={chatbotId}
              />
            )}
            {!isUser && message.sources?.length ? (
              <Citations
                sources={message.sources}
                provider={message.searchProvider}
              />
            ) : null}
            {!isUser && !message.artifact && (
              <button
                type="button"
                onClick={() => {
                  if (noteState.saved || noteState.saving) return
                  noteState.onAdd()
                }}
                disabled={noteState.saved || noteState.saving}
                aria-label={
                  noteState.saved
                    ? "Message added to notes"
                    : "Add message to notes"
                }
                title={
                  noteState.saved
                    ? "Added to notes"
                    : noteState.saving
                      ? "Adding…"
                      : "Add to notes"
                }
                className={cn(
                  "absolute bottom-2 right-2 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                  isUser
                    ? "border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
                    : "border-border/60 bg-background/80 text-muted-foreground hover:bg-background hover:text-foreground",
                  noteState.saved &&
                  (isUser
                    ? "border-primary-foreground/40 bg-primary-foreground/20"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"),
                  noteState.saving && "opacity-60",
                )}
              >
                <StickyNote className="size-3" />

                {noteState.saved
                  ? "In notes"
                  : noteState.saving
                    ? "Adding…"
                    : "Add notes"}

              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ArtifactCard({
  artifact,
  saveState,
  chatbotId,
}: {
  artifact: NonNullable<ChatBubbleMessage["artifact"]>
  saveState?: ArtifactSaveState
  chatbotId?: string
}) {
  const kindLabel = artifactKindLabel(artifact.kind)
  const icon = artifactKindIcon(artifact.kind)
  // Prefer the chat-scoped detail route so the page can fetch from the BE
  // instead of relying on localStorage. Falls back to the legacy route when
  // the chatbot id is not known (older callers).
  const href = chatbotId
    ? `/chat/${chatbotId}/artifacts/${artifact.id}`
    : `/artifacts/${artifact.id}`

  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-current/15 bg-background/60 px-3 py-2 text-foreground transition-colors hover:bg-background">
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-2">
        <span className="text-lg" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{artifact.title}</div>
          <div className="text-xs text-muted-foreground">{kindLabel}</div>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        {saveState && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              if (saveState.saved || saveState.saving) return
              saveState.onSave()
            }}
            disabled={saveState.saved || saveState.saving}
            aria-label={
              saveState.saved
                ? "Artifact saved to this chat"
                : "Save artifact to this chat"
            }
            title={saveState.saved ? "Saved" : "Save to this chat"}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border transition-colors",
              saveState.saved
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-current/20 text-muted-foreground hover:bg-background hover:text-foreground",
              saveState.saving && "opacity-60",
            )}
          >
            {saveState.saved ? (
              <BookmarkCheck className="size-3.5" />
            ) : (
              <Bookmark className="size-3.5" />
            )}
          </button>
        )}
        <Link href={href} className="text-xs font-medium text-primary">
          Open →
        </Link>
      </div>
    </div>
  )
}

export function TypingDots() {
  return (
    <span className="inline-flex gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
    </span>
  )
}
