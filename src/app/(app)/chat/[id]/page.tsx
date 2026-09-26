"use client"

import { useParams } from "next/navigation"

import { ChatThread } from "@/components/chat/chat-thread"

export default function ChatConversationPage() {
  const params = useParams<{ id: string }>()
  return params?.id ? <ChatThread chatId={params.id} /> : null
}
