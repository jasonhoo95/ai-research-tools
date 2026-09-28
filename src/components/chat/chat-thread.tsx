"use client"

import * as React from "react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { ApiError } from "@/lib/api"
import { chatClient } from "@/lib/chat-client"
import { ArrowDown, Loader2, Pin } from "lucide-react"
import {
  chatRepo,
  type ArtifactChatRow,
  type ChatRow,
  type MessageContent,
  type MessagePage,
} from "@/lib/chat-repo"
import type {
  ChatHistoryItem,
  ChatResponse,
  FileChatResponse,
  GeneratedArtifact,
} from "@/lib/chat-types"
import { artifactKindLabel } from "@/lib/artifact-labels"
import { artifactsStore } from "@/lib/artifacts-store"
import { normalizeGeneratedArtifact } from "@/lib/artifact-chat-row"
import {
  appendNoteToNotesboard,
  buildNoteFromMessage,
  createChatNotesboardArtifact,
  findChatNotesboard,
} from "@/lib/chat-notesboard"
import {
  MessageBubble,
  type ChatBubbleMessage,
} from "@/components/chat/message-bubble"
import { Composer } from "@/components/chat/composer"
import { DateSeparator, dayKey } from "@/components/chat/date-separator"
import { MessageSearch } from "@/components/chat/message-search"
import {
  CreateArtifactMenu,
  type CreatableArtifactKind,
  type CreateArtifactInput,
} from "@/components/chat/create-artifact-menu"
import {
  ArtifactsPanel,
  type ChatArtifactItem,
  type ChatPanelTab,
  type PinnedMessageItem,
} from "@/components/chat/artifacts-panel"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AppDialog } from "@/components/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useForm } from "react-hook-form"

const addNoteSchema = z.object({
  title: z.string().min(1, "Title is required").max(120, "Title is too long"),
  description: z.string().optional(),
})

type AddNoteValues = z.infer<typeof addNoteSchema>


function contentToBubble(row: {
  id: string
  content: MessageContent
  created_at: string
  pin_message?: boolean | null
}): ChatBubbleMessage {
  return {
    id: row.id,
    createdAt: row.created_at,
    pinned: Boolean(row.pin_message),
    role: row.content.role,
    content: row.content.text,
    attachment: row.content.attachment,
    attachments: row.content.attachments,
    artifact: row.content.artifact,
    sources: row.content.sources,
    searchProvider: row.content.searchProvider,
    fileSources: row.content.fileSources,
    fileReferences: row.content.fileReferences,
    links: row.content.links,
  }
}

/** Links in a message, like the backend finds them (for the waiting label). */
function countLinks(text: string) {
  return new Set(text.match(/\bhttps?:\/\/[^\s<>"'`]+|\bwww\.[a-z0-9-]+\.[a-z]/gi) ?? []).size
}

const PAGE_SIZE = 30
/** Distance (px) from an edge at which the next page starts loading. */
const LOAD_MARGIN_PX = 300
const HIGHLIGHT_MS = 2000

const MAX_HISTORY_MESSAGES = 5
function toHistory(messages: ChatBubbleMessage[]): ChatHistoryItem[] {
  return messages
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m): ChatHistoryItem => {
      // Files aren't re-sent, but naming them keeps follow-ups in context.
      // It also keeps a files-only message from being an empty turn, which
      // the backend rejects.
      const files = (m.attachments ?? (m.attachment ? [m.attachment] : [])).map((a) => a.name)
      const content = [m.content.trim(), files.length ? `[Attached files: ${files.join(", ")}]` : ""]
        .filter(Boolean)
        .join("\n")
      return { role: m.role === "assistant" ? "model" : "user", content }
    })
    .filter((item) => item.content)
}

export interface ChatThreadProps {
  chatId: string
  /**
   * "docs": a document workspace — questions search its documents and files
   * attached in the composer are added to it.
   */
  variant?: "chat" | "docs"
  /** Docs: only ask about these documents (all when empty). */
  fileIds?: string[]
  /** Docs: add attached files to the workspace; resolves to the new file ids. */
  onAddDocuments?: (files: File[]) => Promise<string[]>
  /** Lets the page add, replace or remove artifacts it saved itself. */
  handleRef?: React.Ref<ChatThreadHandle>
  /** The chat's saved artifacts, whenever they change. */
  onArtifactsChange?: (rows: ArtifactChatRow[]) => void
  /** An artifact in the side panel was clicked; return true when handled. */
  onArtifactSelect?: (item: ChatArtifactItem) => boolean
  /** Links in a question were saved as chat files (docs: new documents). */
  onLinksSaved?: () => void
  /** Shown above the composer (docs: which documents questions are about). */
  composerAccessory?: React.ReactNode
  /** Composer placeholder when nothing is attached. */
  composerPlaceholder?: string
  /** Shown when the thread has no messages yet. */
  emptyState?: React.ReactNode
  /**
   * Pad the thread so the side panel doesn't cover it (the chat page). The
   * docs page makes room itself via onPanelOpenChange.
   */
  reservePanelSpace?: boolean
  onPanelOpenChange?: (open: boolean) => void
}

export interface ChatThreadHandle {
  addArtifact: (row: ArtifactChatRow) => void
  replaceArtifact: (row: ArtifactChatRow) => void
  removeArtifact: (rowId: string) => void
}

/**
 * A conversation with search, pins, artifacts and the composer. Used by the
 * chat page and by docs workspaces (next to the document viewer).
 */
export function ChatThread({
  chatId,
  variant = "chat",
  fileIds,
  onAddDocuments,
  handleRef,
  onArtifactsChange,
  onArtifactSelect,
  onLinksSaved,
  composerAccessory,
  composerPlaceholder,
  emptyState,
  reservePanelSpace = true,
  onPanelOpenChange,
}: ChatThreadProps) {
  const isDocs = variant === "docs"
  const [noteDialogOpen, setNoteDialogOpen] = useState({
    open: false,
    content: null,
  })
  const [chat, setChat] = React.useState<ChatRow | null>(null)
  const [messages, setMessages] = React.useState<ChatBubbleMessage[]>([])
  const [pending, setPending] = React.useState(false)
  /** What the pending answer is doing, e.g. reading links. */
  const [pendingLabel, setPendingLabel] = React.useState<string | undefined>()
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)
  const [artifactsOpen, setArtifactsOpen] = React.useState(false)
  const [panelTab, setPanelTab] = React.useState<ChatPanelTab>("artifacts")
  React.useEffect(() => {
    onPanelOpenChange?.(artifactsOpen)
  }, [artifactsOpen, onPanelOpenChange])
  const [pinnedMessages, setPinnedMessages] = React.useState<PinnedMessageItem[]>([])
  const [pinningIds, setPinningIds] = React.useState<Set<string>>(() => new Set())
  const [pinnedArtifacts, setPinnedArtifacts] = React.useState<ArtifactChatRow[]>(
    [],
  )
  React.useImperativeHandle(
    handleRef,
    () => ({
      addArtifact: (row) => setPinnedArtifacts((prev) => [row, ...prev]),
      replaceArtifact: (row) =>
        setPinnedArtifacts((prev) => prev.map((r) => (r.id === row.id ? row : r))),
      removeArtifact: (rowId) =>
        setPinnedArtifacts((prev) => prev.filter((r) => r.id !== rowId)),
    }),
    [],
  )
  React.useEffect(() => {
    onArtifactsChange?.(pinnedArtifacts)
  }, [pinnedArtifacts, onArtifactsChange])
  const [savingArtifactIds, setSavingArtifactIds] = React.useState<Set<string>>(
    () => new Set(),
  )
  const [deletingRowIds, setDeletingRowIds] = React.useState<Set<string>>(
    () => new Set(),
  )
  const [addingNoteMessageIds, setAddingNoteMessageIds] = React.useState<
    Set<string>
  >(() => new Set())

  const scrollRef = React.useRef<HTMLDivElement>(null)
  const topSentinelRef = React.useRef<HTMLDivElement>(null)
  const bottomSentinelRef = React.useRef<HTMLDivElement>(null)

  // Pagination window. When the user jumps to a search hit the window can
  // sit in the middle of the history, so both directions may have more.
  const [hasMoreBefore, setHasMoreBefore] = React.useState(false)
  const [hasMoreAfter, setHasMoreAfter] = React.useState(false)
  const beforeCursorRef = React.useRef<string | null>(null)
  const afterCursorRef = React.useRef<string | null>(null)
  const [loadingOlder, setLoadingOlder] = React.useState(false)
  const [loadingNewer, setLoadingNewer] = React.useState(false)
  // Bumped whenever the window is replaced so stale page loads are dropped.
  const windowGenRef = React.useRef(0)
  // Scroll height captured before prepending older messages, so the view
  // can be re-anchored instead of jumping.
  const prependAnchorRef = React.useRef<{ height: number; top: number } | null>(
    null,
  )
  const [scrollTarget, setScrollTarget] = React.useState<
    { kind: "bottom"; smooth: boolean } | { kind: "message"; id: string } | null
  >(null)
  const [highlightId, setHighlightId] = React.useState<string | null>(null)
  const [showJumpToLatest, setShowJumpToLatest] = React.useState(false)

  // artifact_chat row ids keyed by what the bubble buttons refer to, so a
  // saved item can be highlighted and removed again. Artifacts saved from a
  // bubble store the whole message: content.id is the message id and
  // content.artifact.id the artifact id, so both are indexed.
  const { artifactRowIds, noteRowIds } = React.useMemo(() => {
    const artifacts = new Map<string, string[]>()
    const notes = new Map<string, string[]>()
    const add = (map: Map<string, string[]>, key: string, rowId: string) =>
      map.set(key, [...(map.get(key) ?? []), rowId])

    for (const row of pinnedArtifacts) {
      const content = normalizeGeneratedArtifact(row.content)
      if (!content) continue
      const inner = content.artifact as { kind: string; id?: string }
      if (inner.kind === "notes") {
        add(notes, content.id, row.id)
        continue
      }
      add(artifacts, content.id, row.id)
      if (inner.id && inner.id !== content.id) add(artifacts, inner.id, row.id)
    }
    return { artifactRowIds: artifacts, noteRowIds: notes }
  }, [pinnedArtifacts])

  const notesboardRow = React.useMemo(
    () => findChatNotesboard(pinnedArtifacts),
    [pinnedArtifacts],
  )


  const chatArtifacts = React.useMemo<ChatArtifactItem[]>(
    () =>
      pinnedArtifacts.map((row) => ({
        rowId: row.id,
        id: row.id,
        kind: row.content.artifact.kind,
        title: row.content.artifact.title,
        createdAt: row.created_at,
      })),
    [pinnedArtifacts],
  )


  /** Replace the whole message window with `page`. */
  const applyWindow = React.useCallback((page: MessagePage) => {
    windowGenRef.current++
    prependAnchorRef.current = null
    const bubbles = page.items.map(contentToBubble)
    setMessages(bubbles)
    setHasMoreBefore(page.hasMoreBefore)
    setHasMoreAfter(page.hasMoreAfter)
    beforeCursorRef.current = page.beforeCursor
    afterCursorRef.current = page.afterCursor
    return bubbles
  }, [])

  const loadLatest = React.useCallback(async () => {
    const page = await chatRepo.listMessages(chatId, { limit: PAGE_SIZE })
    return applyWindow(page)
  }, [chatId, applyWindow])

  const loadOlder = React.useCallback(async () => {
    const cursor = beforeCursorRef.current
    if (!chatId || !cursor || loadingOlder) return
    const gen = windowGenRef.current
    setLoadingOlder(true)
    try {
      const page = await chatRepo.listMessages(chatId, {
        limit: PAGE_SIZE,
        before: cursor,
      })
      if (gen !== windowGenRef.current) return
      const el = scrollRef.current
      if (el) {
        prependAnchorRef.current = { height: el.scrollHeight, top: el.scrollTop }
      }
      setMessages((prev) => [...page.items.map(contentToBubble), ...prev])
      setHasMoreBefore(page.hasMoreBefore)
      if (page.beforeCursor) beforeCursorRef.current = page.beforeCursor
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoadingOlder(false)
    }
  }, [chatId, loadingOlder])

  const loadNewer = React.useCallback(async () => {
    const cursor = afterCursorRef.current
    if (!chatId || !cursor || loadingNewer) return
    const gen = windowGenRef.current
    setLoadingNewer(true)
    try {
      const page = await chatRepo.listMessages(chatId, {
        limit: PAGE_SIZE,
        after: cursor,
      })
      if (gen !== windowGenRef.current) return
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id))
        return [
          ...prev,
          ...page.items.map(contentToBubble).filter((m) => !seen.has(m.id)),
        ]
      })
      setHasMoreAfter(page.hasMoreAfter)
      if (page.afterCursor) afterCursorRef.current = page.afterCursor
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoadingNewer(false)
    }
  }, [chatId, loadingNewer])

  /** Load (if needed) and scroll to a message, e.g. from a search hit. */
  const jumpToMessage = React.useCallback(
    async (messageId: string) => {
      if (!chatId) return
      if (!messages.some((m) => m.id === messageId)) {
        try {
          const page = await chatRepo.listMessages(chatId, {
            limit: PAGE_SIZE,
            around: messageId,
          })
          applyWindow(page)
        } catch (err) {
          setError((err as Error).message)
          return
        }
      }
      setScrollTarget({ kind: "message", id: messageId })
    },
    [chatId, messages, applyWindow],
  )

  const jumpToLatest = async () => {
    if (hasMoreAfter) {
      try {
        await loadLatest()
      } catch (err) {
        setError((err as Error).message)
        return
      }
    }
    setScrollTarget({ kind: "bottom", smooth: !hasMoreAfter })
  }

  async function fetchAll() {
    const [c, page, artifacts, pinned] = await Promise.all([
      chatRepo.getChat(chatId),
      chatRepo.listMessages(chatId, { limit: PAGE_SIZE }),
      chatRepo.listArtifacts(chatId).catch(() => []),
      chatRepo.listPinnedMessages(chatId).catch(() => []),
    ])
    if (!c) {
      setNotFound(true)
      return
    }
    setChat(c)
    applyWindow(page)
    setPinnedMessages(
      pinned.map((row) => ({
        id: row.id,
        text: row.content.text,
        createdAt: row.created_at,
      })),
    )
    setScrollTarget({ kind: "bottom", smooth: false })

    setPinnedArtifacts(artifacts)
    // Warm the local artifact cache so /artifacts/[id] can open them
    // even without a fresh Gemini call.
    for (const row of artifacts) {
      if (row.content) artifactsStore.save(row.content)
    }
    setLoading(false)
  }

  useEffect(() => {
    (async () => {
      await fetchAll()
    })()
  }, [chatId])

  const noteForm = useForm<AddNoteValues>({
    resolver: zodResolver(addNoteSchema),
    defaultValues: { title: "", description: "" },
  })


  // Keep the viewport anchored when older messages are prepended.
  React.useLayoutEffect(() => {
    const anchor = prependAnchorRef.current
    const el = scrollRef.current
    if (!anchor || !el) return
    prependAnchorRef.current = null
    el.scrollTop = anchor.top + (el.scrollHeight - anchor.height)
  }, [messages])

  // Run a requested scroll once the messages it depends on have rendered.
  React.useLayoutEffect(() => {
    if (!scrollTarget) return
    const el = scrollRef.current
    if (!el) return
    if (scrollTarget.kind === "bottom") {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: scrollTarget.smooth ? "smooth" : "auto",
      })
    } else {
      const node = el.querySelector<HTMLElement>(
        `[data-message-id="${CSS.escape(scrollTarget.id)}"]`,
      )
      if (!node) return
      // Tall answers read from their start; short ones sit mid-screen.
      node.scrollIntoView({
        block: node.offsetHeight > el.clientHeight * 0.8 ? "start" : "center",
      })
      setHighlightId(scrollTarget.id)
    }
    setScrollTarget(null)
  }, [scrollTarget, messages, pending, loading])

  React.useEffect(() => {
    if (!highlightId) return
    const t = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS)
    return () => clearTimeout(t)
  }, [highlightId])

  // Infinite scroll: load older at the top, newer at the bottom (the latter
  // only after jumping into the middle of the history).
  React.useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          if (entry.target === topSentinelRef.current && hasMoreBefore) {
            void loadOlder()
          }
          if (entry.target === bottomSentinelRef.current && hasMoreAfter) {
            void loadNewer()
          }
        }
      },
      { root, rootMargin: `${LOAD_MARGIN_PX}px 0px` },
    )
    if (topSentinelRef.current) observer.observe(topSentinelRef.current)
    if (bottomSentinelRef.current) observer.observe(bottomSentinelRef.current)
    return () => observer.disconnect()
    // Re-observing after each page makes the observer fire again if the
    // sentinel is still visible (e.g. a short first page).
  }, [hasMoreBefore, hasMoreAfter, loadOlder, loadNewer, messages, loading])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowJumpToLatest(hasMoreAfter || fromBottom > 400)
  }

  React.useEffect(() => {
    if (hasMoreAfter) setShowJumpToLatest(true)
  }, [hasMoreAfter])

  const send = async (text: string, files: File[]) => {
    if (!chatId) return
    const value = text.trim()
    if ((!value && !files.length) || pending) return

    setError(null)

    // If the user scrolled back via search, snap to the latest messages so
    // the new message lands after them and history is the real tail.
    let base = messages
    if (hasMoreAfter) {
      try {
        base = await loadLatest()
      } catch (err) {
        setError((err as Error).message)
        return
      }
    }

    const userContent: MessageContent = {
      role: "user",
      // Files alone are fine: the bubble shows just the file cards.
      text: value,
      attachments: files.length
        ? files.map((f) => ({ name: f.name, kind: f.type || "file", size: f.size }))
        : undefined,
    }

    let userMsgId = crypto.randomUUID()
    const optimisticUser: ChatBubbleMessage = {
      id: userMsgId,
      role: "user",
      content: userContent.text,
      attachments: userContent.attachments,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticUser])
    setPending(true)
    const linkCount = countLinks(value)
    setPendingLabel(
      linkCount ? (linkCount === 1 ? "Reading the link…" : `Reading ${linkCount} links…`) : undefined,
    )
    setScrollTarget({ kind: "bottom", smooth: true })

    try {
      const savedUser = await chatRepo.appendMessage(chatId, userContent)
      userMsgId = savedUser.id
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticUser.id
            ? { ...m, id: savedUser.id, createdAt: savedUser.created_at }
            : m,
        ),
      )

      const history = toHistory(base)
      const questionForGemini =
        value ||
        (files.length > 1
          ? "Summarize each of these files, then compare them: key points, similarities and differences."
          : files.length === 1
            ? "Please summarize this file and highlight its key points."
            : "")

      let data: ChatResponse & Pick<Partial<FileChatResponse>, "indexed">
      if (isDocs) {
        // Docs: attached files join the workspace, then the question is
        // answered from its documents (only the new ones when it was just
        // "here are some files").
        const added = files.length && onAddDocuments ? await onAddDocuments(files) : []
        data = await chatClient.ask({
          message: questionForGemini,
          history,
          chatId,
          fileIds: !value && added.length ? added : fileIds?.length ? fileIds : undefined,
        })
      } else {
        data = files.length
          ? await chatClient.askWithFiles({
            files,
            message: questionForGemini,
            history,
            chatId,
            messageId: savedUser.id,
          })
          : await chatClient.ask({ message: questionForGemini, history, chatId })
      }
      // Answers still arrive when indexing fails; follow-ups just can't
      // search those files.
      const notIndexed = (data.indexed ?? []).filter((f) => f.error).map((f) => f.name)
      if (notIndexed.length) {
        setError(
          `Couldn't index ${notIndexed.join(", ")} for follow-up questions. You can still ask about ${notIndexed.length > 1 ? "them" : "it"} by attaching again.`,
        )
      }
      if (data.artifact) {
        artifactsStore.save(data.artifact)
      }

      const assistantContent: MessageContent = {
        role: "assistant",
        text: data.reply?.trim() || "(no response)",
        artifact: data.artifact
          ? { ...data.artifact.artifact, id: data.artifact.id }
          : undefined,
        sources: data.sources,
        searchProvider: data.searchProvider,
        fileSources: data.fileSources?.length ? data.fileSources : undefined,
        fileReferences: data.fileReferences?.length ? data.fileReferences : undefined,
        links: data.links?.length ? data.links : undefined,
      }
      if (data.links?.some((link) => link.fileId)) onLinksSaved?.()
      const savedAssistant = await chatRepo.appendMessage(chatId, assistantContent)

      setMessages((prev) => [
        ...prev,
        {
          id: savedAssistant.id,
          createdAt: savedAssistant.created_at,
          role: "assistant",
          artifact: assistantContent.artifact,
          content: assistantContent.text,
          sources: assistantContent.sources,
          searchProvider: assistantContent.searchProvider,
          fileSources: assistantContent.fileSources,
          fileReferences: assistantContent.fileReferences,
          links: assistantContent.links,
        },
      ])
      setScrollTarget({ kind: "bottom", smooth: true })
      afterCursorRef.current = null
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong"
      setError(msg)
    } finally {
      setPending(false)
    }
  }

  /** Reflect a pin change in both the message list and the Pinned tab. */
  const applyPinned = (item: PinnedMessageItem, pinned: boolean) => {
    setMessages((prev) => prev.map((m) => (m.id === item.id ? { ...m, pinned } : m)))
    setPinnedMessages((prev) => {
      const rest = prev.filter((p) => p.id !== item.id)
      if (!pinned) return rest
      // Newest first, like the backend list.
      return [...rest, item].sort((a, b) =>
        (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
      )
    })
  }

  /** Pin or unpin optimistically; roll back if the request fails. */
  const handleTogglePin = async (item: PinnedMessageItem, pinned: boolean) => {
    if (!chatId || pinningIds.has(item.id)) return
    setPinningIds((prev) => new Set(prev).add(item.id))
    applyPinned(item, pinned)
    try {
      await chatRepo.pinMessage(chatId, item.id, pinned)
    } catch (err) {
      applyPinned(item, !pinned)
      setError((err as Error).message)
    } finally {
      setPinningIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  const togglePinnedPanel = () => {
    if (artifactsOpen && panelTab === "pinned") {
      setArtifactsOpen(false)
      return
    }
    setPanelTab("pinned")
    setArtifactsOpen(true)
  }

  /** Delete saved rows (all duplicates) for one bubble button. */
  const handleUnsave = async (
    rowIds: string[],
    key: string,
    setBusy: React.Dispatch<React.SetStateAction<Set<string>>>,
  ) => {
    if (!chatId) return
    setBusy((prev) => new Set(prev).add(key))
    try {
      await Promise.all(rowIds.map((id) => chatRepo.deleteArtifact(chatId, id)))
      setPinnedArtifacts((prev) => prev.filter((row) => !rowIds.includes(row.id)))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  /** Generate an artifact from the + menu and pin it to the Artifacts panel. */
  const handleCreateArtifact = async (input: CreateArtifactInput) => {
    if (!chatId) return
    const history = toHistory(messages).filter((m) => m.content.trim())
    try {
      const generated = await chatClient.generateArtifact({
        kind: input.kind,
        title: input.title || undefined,
        prompt: input.prompt,
        history,
        chatId,
        fileIds: isDocs && fileIds?.length ? fileIds : undefined,
      })
      artifactsStore.save(generated)
      const row = await chatRepo.saveArtifact(chatId, generated)
      setPinnedArtifacts((prev) => [row, ...prev])
      setPanelTab("artifacts")
      setArtifactsOpen(true)
    } catch (err) {
      // Shown inside the dialog, which stays open for another try.
      throw new Error(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Could not create the artifact.",
      )
    }
  }

  /** Messages generating an artifact from their ⋮ menu, and which kind. */
  const [creatingFrom, setCreatingFrom] = React.useState<
    ReadonlyMap<string, CreatableArtifactKind>
  >(new Map())

  /** ⋮ menu on an AI message: make an artifact of `kind` from its answer. */
  const handleCreateFromMessage = async (
    message: ChatBubbleMessage,
    kind: CreatableArtifactKind,
  ) => {
    if (creatingFrom.has(message.id)) return
    setCreatingFrom((prev) => new Map(prev).set(message.id, kind))
    try {
      await handleCreateArtifact({
        kind,
        title: "",
        // Within the backend's prompt limit.
        prompt: `Create a ${artifactKindLabel(kind).toLowerCase()} from this answer. Use it as the source material.\n\n${message.content.slice(0, 18_000)}`,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the artifact.")
    } finally {
      setCreatingFrom((prev) => {
        const next = new Map(prev)
        next.delete(message.id)
        return next
      })
    }
  }

  const handleSaveArtifact = async (content: GeneratedArtifact) => {
    if (!chatId) return
    try {
      const row = await chatRepo.saveArtifact(chatId, content)
      setPinnedArtifacts((prev) => [row, ...prev])
    } catch (err) {
      setError((err as Error).message)
    } finally {

    }
  }

  const handleAddToNotes = async (message: ChatBubbleMessage) => {
    const query = {
      ...message,
      kind: "notes",
      artifact: {
        ...message.artifact,
        content: message.content,
        kind: "notes",
        title: "Notes",
        type: "notes",
      },
    }
    console.log(query, "query content")
    setNoteDialogOpen({
      open: true,
      content: query,
    })

  }

  const handleDeleteArtifact = async (item: ChatArtifactItem) => {
    if (!chatId || !item.rowId) return
    if (deletingRowIds.has(item.rowId)) return

    setDeletingRowIds((prev) => new Set(prev).add(item.rowId!))
    try {
      await chatRepo.deleteArtifact(chatId, item.rowId)
      setPinnedArtifacts((prev) => prev.filter((row) => row.id !== item.rowId))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDeletingRowIds((prev) => {
        const next = new Set(prev)
        next.delete(item.rowId!)
        return next
      })
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Loading conversation…
      </main>
    )
  }

  if (notFound) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-semibold">Chat not found</h1>
        <Link href="/chat" className={buttonVariants()}>
          Back to chats
        </Link>
      </main>
    )
  }



  const handleSubmitNote = async (data: AddNoteValues) => {
    const datas = {
      ...noteDialogOpen.content,
      artifact: {
        ...noteDialogOpen.content.artifact,
        title: data.title,
      },
    }
    await handleSaveArtifact(datas);
    noteForm.reset();
    setNoteDialogOpen({ open: false, content: null });
  }

  return (
    <>
      <AppDialog open={noteDialogOpen.open} onOpenChange={(open) => setNoteDialogOpen({ open, content: null })} title="Add Note" description="Add a note to the chat">
        <Form {...noteForm}>
          <form
            onSubmit={noteForm.handleSubmit(handleSubmitNote)}
            className="grid gap-4 pt-2"
          >
            <FormField
              control={noteForm.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Note title" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={noteForm.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Note content (markdown supported)"
                      className="min-h-[160px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Add Note</Button>
          </form>
        </Form>
      </AppDialog>
      <main
        className="mx-auto chat-container flex min-h-0 w-full max-w-full flex-1 flex-col transition-[padding] duration-300"
        style={{ paddingRight: reservePanelSpace && artifactsOpen ? 360 : 0 }}
      >
        <div className="relative flex min-h-0 flex-1 flex-col">
        {chatId && (
          <div className="absolute right-4 top-3 z-20 flex items-center gap-2">
            <CreateArtifactMenu onCreate={handleCreateArtifact} />
            <Tooltip>
              <TooltipTrigger
                onClick={togglePinnedPanel}
                aria-label={`Pinned messages (${pinnedMessages.length})`}
                aria-pressed={artifactsOpen && panelTab === "pinned"}
                className={cn(
                  "relative flex size-9 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground",
                  artifactsOpen && panelTab === "pinned" && "bg-muted text-foreground",
                )}
              >
                <Pin className="size-4" />
                {pinnedMessages.length > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f97316] px-1 text-[10px] font-semibold leading-none text-white tabular-nums">
                    {pinnedMessages.length > 99 ? "99+" : pinnedMessages.length}
                  </span>
                ) : null}
              </TooltipTrigger>
              <TooltipContent side="bottom" className="z-50">
                {pinnedMessages.length === 0
                  ? "No pinned messages"
                  : `${pinnedMessages.length} pinned message${pinnedMessages.length === 1 ? "" : "s"}`}
              </TooltipContent>
            </Tooltip>
            <MessageSearch chatId={chatId} onSelect={jumpToMessage} />
          </div>
        )}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto [overflow-anchor:none]"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-8">
            <div ref={topSentinelRef} aria-hidden className="h-px" />
            {loadingOlder && (
              <div className="flex justify-center text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            )}
            {!hasMoreBefore && chat?.description && (
              <p className="text-sm text-[#71717a]">{chat.description}</p>
            )}
            {messages.length === 0 && !pending && (
              emptyState ?? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Send your first message to get things started.
                </div>
              )
            )}
            {messages.map((m, i) => {
              const prevCreated = messages[i - 1]?.createdAt
              const showDate =
                m.createdAt &&
                (!prevCreated || dayKey(prevCreated) !== dayKey(m.createdAt))
              const artifactId = m.artifact?.id
              const artifactRows = artifactId ? artifactRowIds.get(artifactId) : undefined
              const noteRows = noteRowIds.get(m.id)
              const saveState = artifactId
                ? {
                  saved: Boolean(artifactRows),
                  saving: savingArtifactIds.has(artifactId),
                  onSave: async () => {
                    setSavingArtifactIds((prev) => new Set(prev).add(artifactId))
                    await handleSaveArtifact(m as unknown as GeneratedArtifact)
                    setSavingArtifactIds((prev) => {
                      const next = new Set(prev)
                      next.delete(artifactId)
                      return next
                    })
                  },
                  onRemove: () =>
                    handleUnsave(artifactRows ?? [], artifactId, setSavingArtifactIds),
                }
                : undefined
              return (
                <React.Fragment key={m.id}>
                {showDate && <DateSeparator iso={m.createdAt!} />}
                <div
                  data-message-id={m.id}
                  className={cn(
                    "-mx-3 rounded-2xl px-3 py-1 transition-colors duration-700",
                    highlightId === m.id && "bg-yellow-100/70 dark:bg-yellow-500/15",
                  )}
                >
                <MessageBubble
                  message={m}
                  artifactSaveState={saveState}
                  noteState={{
                    saved: Boolean(noteRows),
                    saving: addingNoteMessageIds.has(m.id),
                    onAdd: () => handleAddToNotes(m),
                    onRemove: () =>
                      handleUnsave(noteRows ?? [], m.id, setAddingNoteMessageIds),
                  }}
                  pinState={{
                    pinned: Boolean(m.pinned),
                    pending: pinningIds.has(m.id),
                    onToggle: () =>
                      handleTogglePin(
                        { id: m.id, text: m.content, createdAt: m.createdAt },
                        !m.pinned,
                      ),
                  }}
                  createArtifactState={{
                    pending: creatingFrom.get(m.id) ?? null,
                    onCreate: (kind) => void handleCreateFromMessage(m, kind),
                  }}
                  chatbotId={chatId}
                />
                </div>
                </React.Fragment>
              )
            })}
            {loadingNewer && (
              <div className="flex justify-center text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            )}
            <div ref={bottomSentinelRef} aria-hidden className="h-px" />
            {pending && (
              <MessageBubble
                message={{ id: "typing", role: "assistant", content: "" }}
                typing
                typingLabel={pendingLabel}
              />
            )}
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                {error}
              </div>
            )}
          </div>
        </div>
        {showJumpToLatest && (
          <button
            type="button"
            onClick={jumpToLatest}
            aria-label="Jump to latest messages"
            className="absolute bottom-3 left-1/2 z-20 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-md hover:bg-muted hover:text-foreground"
          >
            <ArrowDown className="size-4" />
          </button>
        )}
        </div>

        <div className="bg-gradient-to-t from-background via-background to-background/80 px-4 pt-2 pb-5">
          {composerAccessory}
          <Composer
            onSend={send}
            pending={pending}
            onFileError={setError}
            placeholder={composerPlaceholder}
            attachLabel={isDocs ? "Add documents" : undefined}
            // Docs pages take dropped files as documents themselves.
            dropAnywhere={!isDocs}
          />
        </div>
      </main>

      <ArtifactsPanel
        open={artifactsOpen}
        onOpenChange={setArtifactsOpen}
        tab={panelTab}
        onTabChange={setPanelTab}
        artifacts={chatArtifacts}
        onSelect={onArtifactSelect}
        onDelete={handleDeleteArtifact}
        deleting={deletingRowIds}
        chatbotId={chatId}
        pinned={pinnedMessages}
        onSelectPinned={(id) => void jumpToMessage(id)}
        onUnpin={(id) => {
          const item = pinnedMessages.find((p) => p.id === id)
          if (item) void handleTogglePin(item, false)
        }}
        unpinning={pinningIds}
      />
    </>
  )
}
