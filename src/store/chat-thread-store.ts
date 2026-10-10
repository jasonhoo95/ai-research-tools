"use client"

import { create } from "zustand"
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware"

import type { ArtifactChatRow, ChatRow } from "@/lib/chat-repo"
import type { ChatBubbleMessage } from "@/components/chat/message-bubble"
import type { PinnedMessageItem } from "@/components/chat/artifacts-panel"

/** What a chat thread shows when it opens: its latest messages and side panel. */
export type ThreadSnapshot = {
  chat: ChatRow
  /** The latest messages, oldest first (as loaded and added since). */
  messages: ChatBubbleMessage[]
  hasMoreBefore: boolean
  beforeCursor: string | null
  artifacts: ArtifactChatRow[]
  pinned: PinnedMessageItem[]
  /** When it was last loaded from the server. */
  fetchedAt: number
  /** When it was last opened or changed, for evicting the oldest. */
  usedAt: number
}

/** Opened again within this time, a thread is shown without asking the server. */
export const THREAD_FRESH_MS = 5 * 60 * 1000
/** Threads kept; the least recently used go first. */
const MAX_THREADS = 12

type ChatThreadStore = {
  threads: Record<string, ThreadSnapshot>
  save: (chatId: string, snapshot: Omit<ThreadSnapshot, "usedAt">) => void
  remove: (chatId: string) => void
  clear: () => void
}

/** Keeps the `MAX_THREADS` most recently used threads. */
function trim(threads: Record<string, ThreadSnapshot>, max = MAX_THREADS) {
  const entries = Object.entries(threads)
  if (entries.length <= max) return threads
  entries.sort(([, a], [, b]) => b.usedAt - a.usedAt)
  return Object.fromEntries(entries.slice(0, max))
}

/**
 * localStorage that never throws: when it's full (long threads with
 * artifacts add up), the oldest threads are dropped until the write fits.
 */
const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    let next = value
    for (;;) {
      try {
        localStorage.setItem(name, next)
        return
      } catch {
        const parsed = JSON.parse(next) as { state: { threads: Record<string, ThreadSnapshot> } }
        const count = Object.keys(parsed.state.threads).length
        if (count <= 1) {
          // Even one thread doesn't fit: don't persist; it stays in memory.
          try {
            localStorage.removeItem(name)
          } catch {}
          return
        }
        parsed.state.threads = trim(parsed.state.threads, count - 1)
        next = JSON.stringify(parsed)
      }
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {}
  },
}

/**
 * Chat threads opened before, kept in localStorage so opening one again is
 * instant. ChatThread keeps each snapshot in step with what it shows.
 */
export const useChatThreadStore = create<ChatThreadStore>()(
  persist(
    (set) => ({
      threads: {},
      save: (chatId, snapshot) =>
        set((state) => ({
          threads: trim({ ...state.threads, [chatId]: { ...snapshot, usedAt: Date.now() } }),
        })),
      remove: (chatId) =>
        set((state) => {
          if (!state.threads[chatId]) return state
          const threads = { ...state.threads }
          delete threads[chatId]
          return { threads }
        }),
      clear: () => set({ threads: {} }),
    }),
    {
      name: "chat-threads",
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({ threads: state.threads }),
    },
  ),
)

/** Forget every cached thread (signing in or out). */
export function clearChatThreads() {
  useChatThreadStore.getState().clear()
  useChatThreadStore.persist.clearStorage()
}
