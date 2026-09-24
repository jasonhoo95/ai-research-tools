"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { ApiError } from "@/lib/api"
import { chatClient } from "@/lib/chat-client"
import {
  chatRepo,
  type ArtifactChatRow,
  type ChatRow,
  type MessageContent,
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
import {
  ArtifactsPanel,
  type ChatArtifactItem,
} from "@/components/chat/artifacts-panel"
import { AppDialog } from "@/components/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
}): ChatBubbleMessage {
  return {
    id: row.id,
    role: row.content.role,
    content: row.content.text,
    attachment: row.content.attachment,
    artifact: row.content.artifact,
    sources: row.content.sources,
    searchProvider: row.content.searchProvider,
  }
}

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


  async function fetchAll() {
    const [c, rows, artifacts] = await Promise.all([
      chatRepo.getChat(chatId),
      chatRepo.listMessages(chatId),
      chatRepo.listArtifacts(chatId).catch(() => []),
    ])
    if (!c) {
      setNotFound(true)
      return
    }
    setChat(c)
    setMessages(rows.map(contentToBubble))

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


  React.useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [messages.length, pending])

  const send = async (text: string, file: File | null) => {
    if (!chatId) return
    const value = text.trim()
    if ((!value && !file) || pending) return

    setError(null)

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
    }
    setMessages((prev) => [...prev, optimisticUser])
    setPending(true)

    try {
      const savedUser = await chatRepo.appendMessage(chatId, userContent)
      userMsgId = savedUser.id
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticUser.id ? { ...m, id: savedUser.id } : m)),
      )

      const history = toHistory(messages)
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
          role: "assistant",
          artifact: assistantContent.artifact,
          content: assistantContent.text,
          sources: assistantContent.sources,
          searchProvider: assistantContent.searchProvider,
        },
      ])
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
        className="mx-auto chat-container flex max-h-[calc(100vh-10px)] w-full max-w-full flex-1 flex-col transition-[padding] duration-300"
        style={{ paddingRight: artifactsOpen ? 360 : 0 }}
      >
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-8">
            {chat?.description && (
              <p className="text-sm text-[#71717a]">{chat.description}</p>
            )}
            {messages.length === 0 && !pending && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Send your first message to get things started.
              </div>
            )}
            {messages.map((m) => {
              const artifactId = m.artifact?.id
              const saveState = artifactId
                ? {
                  saved: savedArtifactIds.has(artifactId),
                  saving: savingArtifactIds.has(artifactId),
                  onSave: () => handleSaveArtifact(m),
                }
                : undefined
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  artifactSaveState={saveState}
                  noteState={{
                    saved: notesMessageIds.has(m.id),
                    saving: addingNoteMessageIds.has(m.id),
                    onAdd: () => handleAddToNotes(m),
                  }}
                  chatbotId={chatId}
                />
              )
            })}
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
