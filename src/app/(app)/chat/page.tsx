"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { MessageSquare, Trash2 } from "lucide-react"

import { NewChatDialog, type NewChatValues } from "@/components/chat/new-chat-dialog"
import { chatRepo, isPlainChat, type ChatRow } from "@/lib/chat-repo"

function formatRelative(iso: string) {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const s = Math.round(diffMs / 1000)
  if (s < 60) return "just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.round(h / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}

export default function ChatListPage() {
  const router = useRouter()
  const [chats, setChats] = React.useState<ChatRow[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    chatRepo
      .listChats()
      .then((rows) => {
        if (alive) setChats(rows.filter(isPlainChat))
      })
      .catch((err: Error) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [])

  const handleCreate = async (values: NewChatValues) => {
    try {
      const row = await chatRepo.createChat(values)
      setDialogOpen(false)
      router.push(`/chat/${row.id}`)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this chat and all its messages?")) return
    try {
      await chatRepo.deleteChat(id)
      setChats((prev) => (prev ? prev.filter((c) => c.id !== id) : prev))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[#27272a]">
          Recent chats
        </h1>
        <p className="mt-1 text-sm text-[#71717a]">
          All conversations in your Default folder.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {chats === null && !error && (
        <div className="text-sm text-[#a1a1aa]">Loading chats…</div>
      )}

      {chats && chats.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#ececef] bg-white px-6 py-12 text-center">
          <MessageSquare className="mx-auto mb-3 size-8 text-[#d4d4d8]" />
          <h2 className="text-base font-semibold text-[#27272a]">No chats yet</h2>
          <p className="mt-1 text-sm text-[#71717a]">
            Use the New button above to start your first conversation.
          </p>
        </div>
      )}

      {chats && chats.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[#ececef] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <ul className="divide-y divide-[#f1f1f4]">
            {chats.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/chat/${c.id}`}
                  className="group flex items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-[#fafafa]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[#27272a]">
                      {c.title}
                    </div>
                    {c.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-[#71717a]">
                        {c.description}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-[#a1a1aa]">
                      Updated {formatRelative(c.updated_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      handleDelete(c.id)
                    }}
                    className="rounded-lg p-2 text-[#a1a1aa] opacity-0 transition-opacity hover:bg-[#f4f4f5] hover:text-red-500 group-hover:opacity-100"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <NewChatDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreate}
      />
    </main>
  )
}
