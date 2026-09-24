"use client"

import { useCallback, useEffect, useState } from "react"

import {
  addChatBookmark,
  getBookmarkByMessageId,
  loadChatBookmarks,
  removeChatBookmark,
  type ChatBookmark,
} from "@/lib/chat-bookmarks"

export function useChatBookmarks() {
  const [bookmarks, setBookmarks] = useState<ChatBookmark[]>([])

  const refresh = useCallback(() => {
    setBookmarks(loadChatBookmarks())
  }, [])

  useEffect(() => {
    refresh()

    const onStorage = (event: StorageEvent) => {
      if (event.key === "ai-research-tools.chat-bookmarks") {
        refresh()
      }
    }

    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [refresh])

  const toggleBookmark = useCallback(
    (input: {
      messageId: string
      conversationId: string
      conversationTitle: string
      content: string
    }) => {
      const existing = getBookmarkByMessageId(input.messageId)
      if (existing) {
        removeChatBookmark(input.messageId)
      } else {
        addChatBookmark(input)
      }
      refresh()
    },
    [refresh]
  )

  const isBookmarked = useCallback(
    (messageId: string) =>
      bookmarks.some((bookmark) => bookmark.messageId === messageId),
    [bookmarks]
  )

  return {
    bookmarks,
    refresh,
    toggleBookmark,
    isBookmarked,
  }
}
