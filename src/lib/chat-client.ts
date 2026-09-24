import { appApi } from "@/lib/api"
import type {
  ChatHistoryItem,
  ChatRequestBody,
  ChatResponse,
  FileChatResponse,
} from "@/lib/chat-types"

export const chatClient = {
  async ask(body: ChatRequestBody): Promise<ChatResponse> {
    const { data } = await appApi.post<ChatResponse>("/chat", body)
    return data
  },

  async askWithFile(args: {
    file: File
    message: string
    system?: string
    history?: ChatHistoryItem[]
  }): Promise<FileChatResponse> {
    const form = new FormData()
    form.append("file", args.file)
    form.append("message", args.message)
    if (args.system) form.append("system", args.system)
    if (args.history) form.append("history", JSON.stringify(args.history))

    const { data } = await appApi.post<FileChatResponse>("/chat/file", form)
    return data
  },
}
