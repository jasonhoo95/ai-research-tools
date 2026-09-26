"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  ArrowRight,
  FolderOpen,
  MessageSquare,
  Sparkles,
  Table2,
} from "lucide-react"

import { chatRepo, isPlainChat, type ChatRow } from "@/lib/chat-repo"
import { cn } from "@/lib/utils"

function formatRelative(iso: string) {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const s = Math.round(diffMs / 1000)
  if (s < 60) return "just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return d.toLocaleDateString()
}

const quickLinks = [
  {
    title: "Start a chat",
    description: "Ask Gemini anything or upload a file for analysis.",
    href: "/chat",
    icon: MessageSquare,
    accent: "bg-[#fff7ed] text-[#ea580c]",
  },
  {
    title: "CRM leads",
    description: "Review, filter, and sort your lead pipeline.",
    href: "/details",
    icon: Table2,
    accent: "bg-[#eff6ff] text-[#2563eb]",
  },
  {
    title: "Default folder",
    description: "Browse saved conversations in your workspace.",
    href: "/chat",
    icon: FolderOpen,
    accent: "bg-[#f0fdf4] text-[#16a34a]",
  },
]

export default function DashboardPage() {
  const [chats, setChats] = useState<ChatRow[] | null>(null)

  useEffect(() => {
    chatRepo
      .listChats()
      .then((rows) => setChats(rows.filter(isPlainChat)))
      .catch(() => setChats([]))
  }, [])

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-8 py-10">
      <section className="mb-10">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#fff7ed] px-3 py-1 text-xs font-medium text-[#ea580c]">
          <Sparkles className="size-3.5" />
          Your workspace
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-[#27272a]">
          Welcome back, Jason
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-6 text-[#71717a]">
          Pick up where you left off, start a new research chat, or jump into your
          CRM leads table.
        </p>
      </section>

      <section className="mb-10 grid gap-4 md:grid-cols-3">
        {quickLinks.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="group rounded-2xl border border-[#ececef] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
          >
            <div
              className={cn(
                "mb-4 flex size-10 items-center justify-center rounded-xl",
                item.accent
              )}
            >
              <item.icon className="size-5" strokeWidth={1.75} />
            </div>
            <h2 className="text-base font-semibold text-[#27272a]">{item.title}</h2>
            <p className="mt-1.5 text-sm leading-6 text-[#71717a]">
              {item.description}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#ea580c] opacity-0 transition-opacity group-hover:opacity-100">
              Open
              <ArrowRight className="size-4" />
            </span>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-[#ececef] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#27272a]">Recent chats</h2>
            <Link href="/chat" className="text-sm text-[#ea580c] hover:underline">
              View all
            </Link>
          </div>

          {chats === null && (
            <p className="text-sm text-[#a1a1aa]">Loading chats…</p>
          )}

          {chats && chats.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#ececef] px-4 py-8 text-center">
              <p className="text-sm text-[#71717a]">No conversations yet.</p>
              <Link
                href="/chat"
                className="mt-3 inline-flex text-sm font-medium text-[#ea580c] hover:underline"
              >
                Start your first chat
              </Link>
            </div>
          )}

          {chats && chats.length > 0 && (
            <div className="space-y-1">
              {chats.slice(0, 6).map((chat) => (
                <Link
                  key={chat.id}
                  href={`/chat/${chat.id}`}
                  className="flex items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-[#fafafa]"
                >
                  <div className="min-w-0 pr-4">
                    <p className="truncate text-sm font-medium text-[#27272a]">
                      {chat.title}
                    </p>
                    {chat.description && (
                      <p className="mt-0.5 truncate text-xs text-[#a1a1aa]">
                        {chat.description}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-[#a1a1aa]">
                    {formatRelative(chat.updated_at)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[#ececef] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <h2 className="mb-4 text-base font-semibold text-[#27272a]">Folders</h2>
            <Link
              href="/chat"
              className="flex items-center gap-3 rounded-xl border border-[#ececef] bg-[#fafafa] px-4 py-3 transition-colors hover:bg-[#f4f4f5]"
            >
              <FolderOpen className="size-5 text-[#71717a]" />
              <div>
                <p className="text-sm font-medium text-[#27272a]">Default</p>
                <p className="text-xs text-[#a1a1aa]">
                  {chats?.length ?? 0} conversations
                </p>
              </div>
            </Link>
          </div>

          <div className="rounded-2xl border border-[#ececef] bg-gradient-to-br from-[#fff7ed] to-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
            <p className="text-sm font-semibold text-[#27272a]">Welcome to Saner! 👋</p>
            <p className="mt-2 text-sm leading-6 text-[#71717a]">
              Your AI workspace for research, chat, and lead management — all in one
              place.
            </p>
            <Link
              href="/chat"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#ea580c] hover:underline"
            >
              Create something new
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
