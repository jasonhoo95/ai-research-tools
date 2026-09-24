"use client"

import { ArrowLeft, Bookmark } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import type { Descendant } from "slate"

import { SlateEditor } from "@/components/slate/slate-editor"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  getChatBookmark,
  updateChatBookmarkContent,
  type ChatBookmark,
} from "@/lib/chat-bookmarks"
import {
  markdownToSlateDocument,
  slateDocumentToMarkdown,
} from "@/lib/text-to-slate"

function BookmarkEditor({ bookmark }: { bookmark: ChatBookmark }) {
  const [body, setBody] = useState<Descendant[]>(() =>
    markdownToSlateDocument(bookmark.content)
  )

  const handleChange = useCallback(
    (value: Descendant[]) => {
      setBody(value)
      updateChatBookmarkContent(bookmark.id, slateDocumentToMarkdown(value))
    },
    [bookmark.id]
  )

  return (
    <SlateEditor
      value={body}
      onChange={handleChange}
      showToolbar
      className="h-full"
      editableClassName="prose prose-sm max-w-none px-6 py-5 min-h-[calc(100vh-14rem)] outline-none [&_h1]:mb-3 [&_h2]:mb-2"
    />
  )
}

export default function ChatBookmarkDetailPage() {
  const params = useParams<{ slug: string[] }>()
  const bookmarkId = params.slug?.[0] ?? ""
  const bookmark = useMemo(
    () => (bookmarkId ? getChatBookmark(bookmarkId) : null),
    [bookmarkId]
  )

  if (!bookmark) {
    return (
      <main className="mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-3xl flex-col items-center justify-center gap-4 px-4">
        <Bookmark className="size-10 text-muted-foreground/40" />
        <div className="text-center">
          <h1 className="text-lg font-semibold">Bookmark not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This saved reply may have been removed.
          </p>
        </div>
        <Link href="/chat" className={buttonVariants({ variant: "outline" })}>
          Back to chat
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-4xl flex-col px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/chat"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "mb-2 -ml-2"
            )}
          >
            <ArrowLeft className="size-4" />
            Back to chat
          </Link>
          <h1 className="truncate text-xl font-semibold">{bookmark.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            From {bookmark.conversationTitle}
          </p>
        </div>
        <Bookmark className="mt-8 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-card shadow-sm">
        <BookmarkEditor key={bookmark.id} bookmark={bookmark} />
      </div>
    </main>
  )
}
