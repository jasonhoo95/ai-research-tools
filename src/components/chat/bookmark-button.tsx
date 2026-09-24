"use client"

import { Bookmark, BookmarkCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type BookmarkButtonProps = {
  bookmarked: boolean
  onToggle: () => void
  className?: string
}

export function BookmarkButton({
  bookmarked,
  onToggle,
  className,
}: BookmarkButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark reply"}
      title={bookmarked ? "Remove bookmark" : "Bookmark reply"}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className={cn(
        "size-7 shrink-0 text-muted-foreground hover:text-foreground",
        bookmarked && "text-amber-600 hover:text-amber-700 dark:text-amber-400",
        className
      )}
    >
      {bookmarked ? (
        <BookmarkCheck className="size-3.5 fill-current" />
      ) : (
        <Bookmark className="size-3.5" />
      )}
    </Button>
  )
}
