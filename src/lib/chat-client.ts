import { appApi } from "@/lib/api"
import type {
  ArtifactKind,
  ChatHistoryItem,
  ChatRequestBody,
  ChatResponse,
  FileChatResponse,
  GeneratedArtifact,
} from "@/lib/chat-types"

export const chatClient = {
  async ask(body: ChatRequestBody): Promise<ChatResponse> {
    // Links in the message (a long YouTube video) can take minutes to read.
    const { data } = await appApi.post<ChatResponse>("/chat", body, { timeout: 300_000 })
    return data
  },

  /** Generate one artifact of the given kind from a title and prompt. */
  async generateArtifact(body: {
    kind: ArtifactKind
    title?: string
    prompt: string
    history?: ChatHistoryItem[]
    /** Build it from this chat's uploaded documents where relevant. */
    chatId?: string
    fileIds?: string[]
  }): Promise<GeneratedArtifact> {
    const { data } = await appApi.post<GeneratedArtifact>("/chat/artifact", body)
    return data
  },

  /** Ask about one or more files, e.g. to compare or extract from them. */
  async askWithFiles(args: {
    files: File[]
    message: string
    system?: string
    history?: ChatHistoryItem[]
    /** Index the files into this chat so follow-ups can search them. */
    chatId?: string
    /** The user message the files were sent with. */
    messageId?: string
  }): Promise<FileChatResponse> {
    const form = new FormData()
    for (const file of args.files) form.append("files", file)
    form.append("message", args.message)
    if (args.system) form.append("system", args.system)
    if (args.history) form.append("history", JSON.stringify(args.history))
    if (args.chatId) form.append("chatId", args.chatId)
    if (args.messageId) form.append("messageId", args.messageId)

    const { data } = await appApi.post<FileChatResponse>("/chat/file", form)
    return data
  },
}
