"use client"

import { ChevronLeft, ChevronRight, Bookmark } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ChatBookmark } from "@/lib/chat-bookmarks"
import { cn } from "@/lib/utils"

type BookmarksPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookmarks: ChatBookmark[]
}

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso))
  } catch {
    return ""
  }
}

export function BookmarksPanel({
  open,
  onOpenChange,
  bookmarks,
}: BookmarksPanelProps) {
  const router = useRouter()

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close bookmarks panel" : "Open bookmarks panel"}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "fixed top-1/2 z-40 flex h-16 w-5 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 bg-background shadow-md transition-all hover:bg-muted",
          open ? "right-[320px]" : "right-0"
        )}
      >
        {open ? (
          <ChevronRight className="size-4 text-muted-foreground" />
        ) : (
          <ChevronLeft className="size-4 text-muted-foreground" />
        )}
      </button>

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-30 flex w-[320px] flex-col border-l bg-background shadow-xl transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
        style={{ top: "3.5rem" }}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Bookmark className="size-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-sm font-semibold">Bookmarks</h2>
          </div>
          <span className="text-xs text-muted-foreground">{bookmarks.length}</span>
        </div>

        <ScrollArea className="flex-1">
          {bookmarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <Bookmark className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Bookmark assistant replies to save them here.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1 p-2">
              {bookmarks.map((bookmark) => (
                <li key={bookmark.id}>
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/chat/${bookmark.id}`)
                      onOpenChange(false)
                    }}
                    className="w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
                  >
                    <p className="line-clamp-2 text-sm font-medium leading-5">
                      {bookmark.title}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {bookmark.conversationTitle}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/80">
                      {formatWhen(bookmark.createdAt)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        <div className="border-t p-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Close panel
          </Button>
        </div>
      </aside>
    </>
  )
}
