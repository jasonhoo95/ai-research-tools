"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Bell,
  Calendar,
  ChevronDown,
  ChevronRight,
  Home,
  Inbox,
  ListTodo,
  Search,
} from "lucide-react"
import { useEffect, useState } from "react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { chatRepo, type ChatRow } from "@/lib/chat-repo"
import { cn } from "@/lib/utils"

const mainNav = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/details", label: "Task", icon: ListTodo },
  { href: "/chat", label: "Inbox", icon: Inbox },
  { href: "/dashboard", label: "Calendar", icon: Calendar },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [recentOpen, setRecentOpen] = useState(true)
  const [foldersOpen, setFoldersOpen] = useState(true)
  const [recentChats, setRecentChats] = useState<ChatRow[]>([])

  useEffect(() => {
    chatRepo
      .listChats()
      .then(setRecentChats)
      .catch(() => setRecentChats([]))
  }, [pathname])

  return (
    <aside className="flex h-screen w-[248px] shrink-0 flex-col border-r border-[#ececef] bg-[#f7f7f8]">
      <div className="flex items-center justify-between gap-2 px-4 pt-5 pb-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar className="size-9 border border-white shadow-sm">
            <AvatarFallback className="bg-[#ffe8d6] text-sm font-semibold text-[#ea580c]">
              JH
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#27272a]">Jason hoo</p>
            <p className="text-xs text-[#a1a1aa]">Free Plan</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Search"
            className="flex size-8 items-center justify-center rounded-lg text-[#71717a] transition-colors hover:bg-white hover:text-[#27272a]"
          >
            <Search className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Notifications"
            className="flex size-8 items-center justify-center rounded-lg text-[#71717a] transition-colors hover:bg-white hover:text-[#27272a]"
          >
            <Bell className="size-4" />
          </button>
        </div>
      </div>

      <nav className="space-y-0.5 px-3">
        {mainNav.map((item) => {
          const active =
            item.label === "Inbox"
              ? pathname.startsWith("/chat")
              : pathname === item.href ||
                (item.label === "Home" && pathname === "/dashboard")

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-white text-[#27272a] shadow-sm"
                  : "text-[#52525b] hover:bg-white/70 hover:text-[#27272a]"
              )}
            >
              <item.icon className="size-[18px] shrink-0" strokeWidth={1.75} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-6 px-4">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-[#a1a1aa] uppercase">
          Library
        </p>

        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setRecentOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[#52525b] hover:bg-white/70"
          >
            {recentOpen ? (
              <ChevronDown className="size-4 text-[#a1a1aa]" />
            ) : (
              <ChevronRight className="size-4 text-[#a1a1aa]" />
            )}
            <span className="font-medium">Recent chats</span>
            <span className="ml-auto text-xs text-[#a1a1aa]">{recentChats.length}</span>
          </button>

          {recentOpen && (
            <div className="ml-5 space-y-0.5 border-l border-[#ececef] pl-3">
              {recentChats.slice(0, 5).map((chat) => (
                <Link
                  key={chat.id}
                  href={`/chat/${chat.id}`}
                  className={cn(
                    "block truncate rounded-lg px-2 py-1.5 text-sm transition-colors",
                    pathname === `/chat/${chat.id}`
                      ? "bg-white font-medium text-[#27272a] shadow-sm"
                      : "text-[#71717a] hover:bg-white/70 hover:text-[#27272a]"
                  )}
                >
                  {chat.title}
                </Link>
              ))}
              {recentChats.length === 0 && (
                <p className="px-2 py-1 text-xs text-[#a1a1aa]">No chats yet</p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setFoldersOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[#52525b] hover:bg-white/70"
          >
            {foldersOpen ? (
              <ChevronDown className="size-4 text-[#a1a1aa]" />
            ) : (
              <ChevronRight className="size-4 text-[#a1a1aa]" />
            )}
            <span className="font-medium">Folders</span>
            <span className="ml-auto text-xs text-[#a1a1aa]">1</span>
          </button>

          {foldersOpen && (
            <div className="ml-5 space-y-0.5 border-l border-[#ececef] pl-3">
              <Link
                href="/chat"
                className="block rounded-lg px-2 py-1.5 text-sm text-[#71717a] hover:bg-white/70 hover:text-[#27272a]"
              >
                Default
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto p-4">
        <Link
          href="/dashboard"
          className="flex items-center justify-between rounded-2xl border border-[#ececef] bg-white px-4 py-3.5 text-sm font-medium text-[#27272a] shadow-sm transition-colors hover:bg-[#fafafa]"
        >
          <span>Welcome to Saner! 👋</span>
          <ChevronRight className="size-4 text-[#a1a1aa]" />
        </Link>
      </div>
    </aside>
  )
}
