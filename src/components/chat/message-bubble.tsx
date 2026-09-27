"use client"

import * as React from "react"
import Link from "next/link"
import {
  Bookmark,
  BookmarkCheck,
  CircleAlert,
  FileSearch,
  FileText,
  Globe,
  Link2,
  Pin,
  SquarePlay,
  StickyNote,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Markdown } from "@/components/markdown"
import { cn } from "@/lib/utils"
import type {
  CitationSource,
  FileReference,
  FileSource,
  GeneratedArtifact,
  LinkSource,
  MessageAttachment,
  SearchProvider,
} from "@/lib/chat-types"
import { MessageAttachments } from "@/components/chat/attachments"
import { artifactKindIcon, artifactKindLabel } from "@/lib/artifact-labels"
import { Citations, linkifyCitations } from "@/components/chat/citations"

export type MessageRole = "user" | "assistant"

export interface ChatBubbleMessage {
  id: string
  role: MessageRole
  content: string
  /** Older messages: a single file. */
  attachment?: { name: string; kind: string }
  attachments?: MessageAttachment[]
  artifact?: {
    id: string
    kind: GeneratedArtifact["artifact"]["kind"]
    title: string
  }
  sources?: CitationSource[]
  searchProvider?: SearchProvider
  /** Uploaded files (and pages) the answer drew on. */
  fileSources?: FileSource[]
  /** The passages used, for highlighting in the docs viewer. */
  fileReferences?: FileReference[]
  /** Links in the question the answer read (or couldn't). */
  links?: LinkSource[]
  /** ISO timestamp — drives the day separators in the message list. */
  createdAt?: string
  /** Pinned to the chat's side panel. */
  pinned?: boolean
}

export interface ArtifactSaveState {
  saved: boolean
  saving: boolean
  onSave: () => void
  /** Unsave: deletes the saved row from this chat's artifacts. */
  onRemove: () => void
}

export interface MessagePinState {
  pinned: boolean
  pending: boolean
  onToggle: () => void
}

export interface MessageNoteState {
  saved: boolean
  saving: boolean
  onAdd: () => void
  /** Deletes the saved note from this chat's artifacts. */
  onRemove: () => void
}

export function MessageBubble({
  message,
  typing,
  artifactSaveState,
  noteState,
  pinState,
  chatbotId,
  onFileSourceClick,
  typingLabel,
}: {
  message: ChatBubbleMessage
  typing?: boolean
  /** Shown next to the typing dots, e.g. "Reading the link…". */
  typingLabel?: string
  /** When present, the artifact card renders a save/pin button. */
  artifactSaveState?: ArtifactSaveState
  /** When present, renders an add-to-notes button on the bubble. */
  noteState?: MessageNoteState
  /** When present, assistant bubbles get a hover pin button (top right). */
  pinState?: MessagePinState
  /** Parent chatbot id, used to build the artifact detail URL. */
  chatbotId?: string
  /** Makes the "From your files" chips open that file's passages. */
  onFileSourceClick?: (fileName: string) => void
}) {
  const isUser = message.role === "user"
  const attachments =
    message.attachments ?? (message.attachment ? [message.attachment] : [])
  // A message can be just files, with no text to show in a bubble.
  const showBubble = typing || message.content.trim().length > 0 || Boolean(message.artifact)
  const showAddNotes =
    noteState && !typing && message.content.trim().length > 0

  return (
    <div className={cn("group/message flex gap-3", isUser && "flex-row-reverse")}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn(isUser ? "bg-primary text-primary-foreground" : "bg-muted")}
        >
          {isUser ? "U" : "AI"}
        </AvatarFallback>
      </Avatar>
      {/* Files sit above the bubble, like ChatGPT. */}
      <div
        className={cn(
          "flex max-w-[75%] min-w-0 flex-col gap-2",
          isUser ? "items-end" : "items-start",
        )}
      >
        {attachments.length > 0 && !typing ? (
          <MessageAttachments
            attachments={attachments}
            className={cn(isUser && "justify-end")}
          />
        ) : null}
        {showBubble ? (
          <div
            className={cn(
              "relative max-w-full rounded-2xl px-4 py-2.5 text-sm leading-6",
              isUser
                ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                : "bg-muted text-foreground",
            )}
          >
            {pinState && !isUser && !typing ? (
              <button
                type="button"
                onClick={pinState.onToggle}
                disabled={pinState.pending}
                aria-pressed={pinState.pinned}
                aria-label={pinState.pinned ? "Unpin message" : "Pin message"}
                title={pinState.pinned ? "Unpin" : "Pin"}
                className={cn(
                  // Just outside the bubble's top-right corner, like ChatGPT's
                  // hover actions; stays visible once pinned.
                  "absolute -right-9 top-0 flex size-7 items-center justify-center rounded-lg transition-[opacity,color,background-color] hover:bg-muted focus-visible:opacity-100 disabled:opacity-50",
                  pinState.pinned
                    ? "text-[#f97316] opacity-100"
                    : "text-muted-foreground opacity-0 hover:text-foreground group-hover/message:opacity-100",
                )}
              >
                <Pin className={cn("size-3.5 transition-transform", pinState.pinned && "rotate-45 fill-current")} />
              </button>
            ) : null}
            {typing ? (
              typingLabel ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <TypingDots />
                  <span className="text-xs">{typingLabel}</span>
                </span>
              ) : (
                <TypingDots />
              )
            ) : (
              <>
                {isUser ? (
                  <LinkifiedText text={message.content} />
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
                {!isUser && message.links?.length ? <LinkSources links={message.links} /> : null}
                {!isUser && message.fileSources?.length ? (
                <FileSources sources={message.fileSources} onSelect={onFileSourceClick} />
              ) : null}
              {!isUser && message.sources?.length ? (
                  <Citations
                    sources={message.sources}
                    provider={message.searchProvider}
                  />
                ) : null}
                {showAddNotes && !isUser && !message.artifact && (
                  <button
                    type="button"
                    onClick={() => {
                      if (noteState.saving) return
                      if (noteState.saved) noteState.onRemove()
                      else noteState.onAdd()
                    }}
                    disabled={noteState.saving}
                    aria-pressed={noteState.saved}
                    aria-label={
                      noteState.saved
                        ? "Remove message from notes"
                        : "Add message to notes"
                    }
                    title={
                      noteState.saved
                        ? "In notes — click to remove"
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
        ) : null}
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
              if (saveState.saving) return
              if (saveState.saved) saveState.onRemove()
              else saveState.onSave()
            }}
            disabled={saveState.saving}
            aria-pressed={saveState.saved}
            aria-label={
              saveState.saved
                ? "Remove artifact from this chat"
                : "Save artifact to this chat"
            }
            title={
              saveState.saved
                ? "Saved — click to remove"
                : "Save to this chat"
            }
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

const URL_IN_TEXT = /(https?:\/\/[^\s<>"'`]+)/g

/** Plain text with its URLs clickable (user messages). */
function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(URL_IN_TEXT)
  if (parts.length === 1) return <>{text}</>
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part.replace(/[.,;:!?)]+$/, "")}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all underline underline-offset-2 opacity-90 hover:opacity-100"
          >
            {part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  )
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/** The links an answer read from, or couldn't open (with why). */
function LinkSources({ links }: { links: LinkSource[] }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <Link2 className="size-3.5 shrink-0" aria-hidden />
      <span>{links.length === 1 ? "Read from link:" : "Read from links:"}</span>
      {links.map((link) => {
        const Icon = link.error
          ? CircleAlert
          : link.kind === "youtube"
            ? SquarePlay
            : link.kind === "pdf"
              ? FileText
              : Globe
        const label = link.title || hostOf(link.url)
        return (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            title={
              link.error
                ? `Couldn't open ${link.url}: ${link.error}`
                : [label, link.siteName, link.truncated ? "Very long — only the start was read" : "", link.url]
                    .filter(Boolean)
                    .join("\n")
            }
            className={cn(
              "inline-flex max-w-64 items-center gap-1 rounded-full border px-2 py-0.5 transition-colors",
              link.error
                ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                : "bg-background/70 text-foreground hover:border-[#f97316]/50 hover:bg-[#f97316]/10",
            )}
          >
            <Icon
              className={cn(
                "size-3.5 shrink-0",
                !link.error && link.kind === "youtube" && "text-red-600",
                !link.error && link.kind === "pdf" && "text-red-500",
                !link.error && link.kind === "web" && "text-sky-600",
              )}
            />
            <span className="truncate">{label}</span>
            {link.error ? <span className="shrink-0">· couldn&apos;t open</span> : null}
          </a>
        )
      })}
    </div>
  )
}

/** "From your files" line under an answer that used uploaded files. */
function FileSources({
  sources,
  onSelect,
}: {
  sources: FileSource[]
  /** Makes each chip a button that opens that file's passages. */
  onSelect?: (fileName: string) => void
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <FileSearch className="size-3.5 shrink-0" aria-hidden />
      <span>From your files:</span>
      {sources.map((source) => {
        const label = (
          <>
            <span className="truncate">{source.fileName}</span>
            {source.pages.length ? (
              <span className="shrink-0 text-muted-foreground">
                · p. {source.pages.join(", ")}
              </span>
            ) : null}
          </>
        )
        const chip =
          "inline-flex max-w-60 items-center gap-1 rounded-full border bg-background/70 px-2 py-0.5 text-foreground"
        return onSelect ? (
          <button
            key={source.fileName}
            type="button"
            title={`Show where in ${source.fileName}`}
            onClick={() => onSelect(source.fileName)}
            className={cn(chip, "transition-colors hover:border-[#f97316]/50 hover:bg-[#f97316]/10")}
          >
            {label}
          </button>
        ) : (
          <span key={source.fileName} className={chip} title={source.fileName}>
            {label}
          </span>
        )
      })}
    </div>
  )
}
