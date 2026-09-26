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
    const { data } = await appApi.post<ChatResponse>("/chat", body)
    return data
  },

  /** Generate one artifact of the given kind from a title and prompt. */
  async generateArtifact(body: {
    kind: ArtifactKind
    title?: string
    prompt: string
    history?: ChatHistoryItem[]
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
  }): Promise<FileChatResponse> {
    const form = new FormData()
    for (const file of args.files) form.append("files", file)
    form.append("message", args.message)
    if (args.system) form.append("system", args.system)
    if (args.history) form.append("history", JSON.stringify(args.history))

    const { data } = await appApi.post<FileChatResponse>("/chat/file", form)
    return data
  },
}
