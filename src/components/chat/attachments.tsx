"use client"

import * as React from "react"
import {
  FileAudio,
  FileCode2,
  FileImage,
  FileText,
  FileVideo,
  File as FileIcon,
  Globe,
  SquarePlay,
  type LucideIcon,
} from "lucide-react"

import type { MessageAttachment } from "@/lib/chat-types"
import { cn } from "@/lib/utils"

export type AttachmentKind =
  | "pdf"
  | "doc"
  | "image"
  | "video"
  | "audio"
  | "text"
  | "youtube"
  | "web"
  | "file"

const KINDS: Record<AttachmentKind, { label: string; icon: LucideIcon; tile: string }> = {
  pdf: { label: "PDF", icon: FileText, tile: "bg-red-500 text-white" },
  doc: { label: "Document", icon: FileText, tile: "bg-blue-500 text-white" },
  image: { label: "Image", icon: FileImage, tile: "bg-emerald-500 text-white" },
  video: { label: "Video", icon: FileVideo, tile: "bg-violet-500 text-white" },
  audio: { label: "Audio", icon: FileAudio, tile: "bg-amber-500 text-white" },
  text: { label: "Text", icon: FileCode2, tile: "bg-zinc-500 text-white" },
  youtube: { label: "YouTube", icon: SquarePlay, tile: "bg-red-600 text-white" },
  web: { label: "Web page", icon: Globe, tile: "bg-sky-500 text-white" },
  file: { label: "File", icon: FileIcon, tile: "bg-zinc-400 text-white" },
}

/** Kind from a MIME type, falling back to the file extension. */
export function attachmentKind(mime: string, name = ""): AttachmentKind {
  const type = mime.toLowerCase()
  const ext = name.toLowerCase().split(".").pop() ?? ""
  // Chat files added from pasted links.
  if (type === "video/youtube") return "youtube"
  if (type === "text/html") return "web"
  if (type === "application/pdf" || ext === "pdf") return "pdf"
  if (type.includes("wordprocessingml") || ext === "docx" || ext === "doc") return "doc"
  if (type.startsWith("image/")) return "image"
  if (type.startsWith("video/")) return "video"
  if (type.startsWith("audio/")) return "audio"
  if (type.startsWith("text/") || type === "application/json" || ["md", "csv", "json", "txt"].includes(ext)) {
    return "text"
  }
  return "file"
}

export function attachmentLabel(kind: AttachmentKind) {
  return KINDS[kind].label
}

export function humanBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** Coloured square with the file-type icon, or an image preview. */
export function AttachmentTile({
  kind,
  previewUrl,
  className,
}: {
  kind: AttachmentKind
  previewUrl?: string
  className?: string
}) {
  if (previewUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local blob preview
      <img
        src={previewUrl}
        alt=""
        className={cn("size-10 shrink-0 rounded-lg object-cover", className)}
      />
    )
  }
  const { icon: Icon, tile } = KINDS[kind]
  return (
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tile, className)}>
      <Icon className="size-5" />
    </span>
  )
}

/** Files attached to a sent message, shown above its text. */
export function MessageAttachments({
  attachments,
  className,
}: {
  attachments: MessageAttachment[]
  className?: string
}) {
  if (!attachments.length) return null
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Attachments">
      {attachments.map((a, i) => {
        const kind = attachmentKind(a.kind, a.name)
        return (
          <li
            key={`${a.name}-${i}`}
            className="flex max-w-60 min-w-0 items-center gap-2.5 rounded-xl border bg-background p-2 pr-3 text-left text-foreground shadow-xs"
          >
            <AttachmentTile kind={kind} className="size-9" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium" title={a.name}>
                {a.name}
              </span>
              <span className="block text-xs text-muted-foreground">
                {attachmentLabel(kind)}
                {a.size ? ` · ${humanBytes(a.size)}` : ""}
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
