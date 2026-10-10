"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronDown, ChevronRight, MessageSquarePlus } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { NewChatDialog, type NewChatValues } from "@/components/chat/new-chat-dialog"
import { OnboardingReplayButton } from "@/components/onboarding/onboarding-replay-button"
import { chatRepo } from "@/lib/chat-repo"
import { useChatThreadStore } from "@/store/chat-thread-store"
import { cn } from "@/lib/utils"

type Crumb = { label: string; href?: string }

function buildCrumbs(pathname: string, chatTitle?: string | null): Crumb[] {
  if (pathname === "/dashboard" || pathname === "/") {
    return [{ label: "Home" }]
  }
  if (pathname === "/chat") {
    return [
      { label: "Home", href: "/dashboard" },
      { label: "Recent chats" },
    ]
  }
  if (pathname.startsWith("/chat/") && !pathname.includes("bookmark")) {
    return [
      { label: "Home", href: "/dashboard" },
      { label: "Folders", href: "/chat" },
      { label: "Default", href: "/chat" },
      { label: chatTitle ?? "Chat" },
    ]
  }
  if (pathname === "/details") {
    return [
      { label: "Home", href: "/dashboard" },
      { label: "CRM Leads" },
    ]
  }
  if (pathname.startsWith("/artifacts/")) {
    return [
      { label: "Home", href: "/dashboard" },
      { label: "Artifacts" },
    ]
  }
  return [{ label: "Home", href: "/dashboard" }]
}

export function AppTopbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)

  const chatIdMatch = pathname.match(/^\/chat\/([^/]+)$/)
  const chatId = chatIdMatch?.[1]

  const chatTitle = useMemo(() => {
    const { chatList } = useChatThreadStore.getState();

    const chatMatch = chatList?.rows.find((o) => o.id === chatId);

    return chatMatch?.title

  }, [chatId])



  const handleCreate = async (values: NewChatValues) => {
    const row = await chatRepo.createChat(values)
    useChatThreadStore.getState().upsertChat(row)
    setDialogOpen(false)
    router.push(`/chat/${row.id}`)
  }


  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#ececef] bg-white px-6">
        <nav className="flex min-w-0 items-center gap-1.5 text-sm">
          <h2 className="text-xl font-semibold">
            {chatTitle}

          </h2>
        </nav>

        <div className="flex items-center gap-2">
          <OnboardingReplayButton />
          <button
            type="button"
            data-tour="new-chat"
            onClick={() => setDialogOpen(true)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-xl bg-[#f97316] px-4 text-sm font-medium text-white",
              "shadow-[0_4px_14px_rgba(249,115,22,0.35)] transition-colors hover:bg-[#ea580c]"
            )}
          >
            <MessageSquarePlus className="size-4" />
            New
            <ChevronDown className="size-3.5 opacity-80" />
          </button>
        </div>
      </header>

      <NewChatDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreate}
      />
    </>
  )
}
