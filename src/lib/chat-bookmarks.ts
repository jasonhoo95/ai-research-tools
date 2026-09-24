export type ChatBookmark = {
  id: string
  messageId: string
  conversationId: string
  conversationTitle: string
  title: string
  content: string
  createdAt: string
}

const STORAGE_KEY = "ai-research-tools.chat-bookmarks"

function readAll(): ChatBookmark[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatBookmark[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(bookmarks: ChatBookmark[]) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks))
  } catch {
    // storage full or disabled
  }
}

export function loadChatBookmarks(): ChatBookmark[] {
  return readAll().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function getChatBookmark(id: string): ChatBookmark | null {
  return readAll().find((bookmark) => bookmark.id === id) ?? null
}

export function isMessageBookmarked(messageId: string): boolean {
  return readAll().some((bookmark) => bookmark.messageId === messageId)
}

export function getBookmarkByMessageId(messageId: string): ChatBookmark | null {
  return readAll().find((bookmark) => bookmark.messageId === messageId) ?? null
}

function makeTitle(content: string) {
  const line = content
    .split("\n")
    .map((part) => part.trim())
    .find(Boolean)

  if (!line) return "Bookmarked reply"
  return line.length > 72 ? `${line.slice(0, 72)}…` : line
}

export function addChatBookmark(input: {
  messageId: string
  conversationId: string
  conversationTitle: string
  content: string
}): ChatBookmark {
  const existing = getBookmarkByMessageId(input.messageId)
  if (existing) return existing

  const bookmark: ChatBookmark = {
    id: crypto.randomUUID(),
    messageId: input.messageId,
    conversationId: input.conversationId,
    conversationTitle: input.conversationTitle,
    title: makeTitle(input.content),
    content: input.content,
    createdAt: new Date().toISOString(),
  }

  writeAll([bookmark, ...readAll()])
  return bookmark
}

export function removeChatBookmark(messageId: string) {
  writeAll(readAll().filter((bookmark) => bookmark.messageId !== messageId))
}

export function updateChatBookmarkContent(id: string, content: string) {
  writeAll(
    readAll().map((bookmark) =>
      bookmark.id === id
        ? { ...bookmark, content, title: makeTitle(content) }
        : bookmark
    )
  )
}

export function removeChatBookmarkById(id: string) {
  writeAll(readAll().filter((bookmark) => bookmark.id !== id))
}
