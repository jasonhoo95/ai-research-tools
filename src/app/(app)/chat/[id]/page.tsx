"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { ApiError } from "@/lib/api"
import { chatClient } from "@/lib/chat-client"
import { ArrowDown, Loader2 } from "lucide-react"
import {
  chatRepo,
  type ArtifactChatRow,
  type ChatRow,
  type MessageContent,
  type MessagePage,
} from "@/lib/chat-repo"
import type { ChatHistoryItem, GeneratedArtifact } from "@/lib/chat-types"
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
  ArtifactsPanel,
  type ChatArtifactItem,
} from "@/components/chat/artifacts-panel"
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
}): ChatBubbleMessage {
  return {
    id: row.id,
    createdAt: row.created_at,
    role: row.content.role,
    content: row.content.text,
    attachment: row.content.attachment,
    artifact: row.content.artifact,
    sources: row.content.sources,
    searchProvider: row.content.searchProvider,
  }
}

const PAGE_SIZE = 30
/** Distance (px) from an edge at which the next page starts loading. */
const LOAD_MARGIN_PX = 300
const HIGHLIGHT_MS = 2000

const MAX_HISTORY_MESSAGES = 5
function toHistory(messages: ChatBubbleMessage[]): ChatHistoryItem[] {
  return messages.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    content: m.content,
  }))
}

export default function ChatConversationPage() {
  const params = useParams<{ id: string }>()
  const chatId = params?.id
  const [noteDialogOpen, setNoteDialogOpen] = useState({
    open: false,
    content: null,
  })
  const [chat, setChat] = React.useState<ChatRow | null>(null)
  const [messages, setMessages] = React.useState<ChatBubbleMessage[]>([])
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [notFound, setNotFound] = React.useState(false)
  const [artifactsOpen, setArtifactsOpen] = React.useState(false)
  const [pinnedArtifacts, setPinnedArtifacts] = React.useState<ArtifactChatRow[]>(
    [],
  )
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

  const savedArtifactIds = React.useMemo(
    () =>
      new Set(
        pinnedArtifacts.flatMap((row) => {
          const content = normalizeGeneratedArtifact(row.content)
          return content ? [content.id] : []
        }),
      ),
    [pinnedArtifacts],
  )

  const notesboardRow = React.useMemo(
    () => findChatNotesboard(pinnedArtifacts),
    [pinnedArtifacts],
  )

  const notesMessageIds = React.useMemo(() => {
    console.log("pinnedArtifacts", pinnedArtifacts)
    const notes = pinnedArtifacts.filter((row) => row.content.artifact.kind === "notes")
    return new Set(notes.map((row) => row.content.id))
  }, [pinnedArtifacts])




  console.log("pinnedArtifacts", pinnedArtifacts)


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
    const [c, page, artifacts] = await Promise.all([
      chatRepo.getChat(chatId),
      chatRepo.listMessages(chatId, { limit: PAGE_SIZE }),
      chatRepo.listArtifacts(chatId).catch(() => []),
    ])
    if (!c) {
      setNotFound(true)
      return
    }
    setChat(c)
    applyWindow(page)
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

  const send = async (text: string, file: File | null) => {
    if (!chatId) return
    const value = text.trim()
    if ((!value && !file) || pending) return

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
      text: value || (file ? "(sent an attachment)" : ""),
      attachment: file ? { name: file.name, kind: file.type || "file" } : undefined,
    }

    let userMsgId = crypto.randomUUID()
    const optimisticUser: ChatBubbleMessage = {
      id: userMsgId,
      role: "user",
      content: userContent.text,
      attachment: userContent.attachment,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticUser])
    setPending(true)
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
        (file ? "Please summarize this file and highlight its key points." : "")

      const data = file
        ? await chatClient.askWithFile({
          file,
          message: questionForGemini,
          history,
        })
        : await chatClient.ask({ message: questionForGemini, history })
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
      }
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
        style={{ paddingRight: artifactsOpen ? 360 : 0 }}
      >
        <div className="relative flex min-h-0 flex-1 flex-col">
        {chatId && (
          <div className="absolute right-4 top-3 z-20">
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
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Send your first message to get things started.
              </div>
            )}
            {messages.map((m, i) => {
              const prevCreated = messages[i - 1]?.createdAt
              const showDate =
                m.createdAt &&
                (!prevCreated || dayKey(prevCreated) !== dayKey(m.createdAt))
              const artifactId = m.artifact?.id
              const saveState = artifactId
                ? {
                  saved: savedArtifactIds.has(artifactId),
                  saving: savingArtifactIds.has(artifactId),
                  onSave: () => handleSaveArtifact(m),
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
                    saved: notesMessageIds.has(m.id),
                    saving: addingNoteMessageIds.has(m.id),
                    onAdd: () => handleAddToNotes(m),
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
          <Composer onSend={send} pending={pending} onFileError={setError} />
        </div>
      </main>

      <ArtifactsPanel
        open={artifactsOpen}
        onOpenChange={setArtifactsOpen}
        artifacts={chatArtifacts}
        onDelete={handleDeleteArtifact}
        deleting={deletingRowIds}
        chatbotId={chatId}
      />
    </>
  )
}
