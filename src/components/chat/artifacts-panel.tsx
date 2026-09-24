"use client"

import { ChevronLeft, ChevronRight, LayoutGrid, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { artifactHref } from "@/lib/artifact-chat-row"
import { artifactsStore } from "@/lib/artifacts-store"
import type { GeneratedArtifact } from "@/lib/chat-types"
import { artifactKindIcon, artifactKindLabel } from "@/lib/artifact-labels"
import { cn } from "@/lib/utils"

export type ChatArtifactItem = {
  /** The artifact_chat row id (used to delete). */
  rowId?: string
  id: string
  kind: GeneratedArtifact["artifact"]["kind"]
  title: string
  createdAt?: string
}

type ArtifactsPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  artifacts: ChatArtifactItem[]
  /** Called when the user presses the trash icon on an item. */
  onDelete?: (item: ChatArtifactItem) => void
  /** Row ids currently mid-delete — used to disable + fade the icon. */
  deleting?: Set<string>
  /** Parent chatbot id — enables the chat-scoped artifact detail URL. */
  chatbotId?: string
}

function formatWhen(iso?: string) {
  if (!iso) return null
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso))
  } catch {
    return null
  }
}

export function ArtifactsPanel({
  open,
  onOpenChange,
  artifacts,
  onDelete,
  deleting,
  chatbotId,
}: ArtifactsPanelProps) {
  const router = useRouter()
  console.log("artifacts", artifacts)
  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close artifacts panel" : "Open artifacts panel"}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "fixed top-1/2 z-40 flex h-16 w-5 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 bg-background shadow-md transition-all hover:bg-muted",
          open ? "right-[360px]" : "right-0",
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
          "fixed inset-y-0 right-0 z-30 flex w-[360px] flex-col border-l bg-background shadow-xl transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
        style={{ top: "3.5rem" }}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="size-4 text-[#f97316]" />
            <h2 className="text-sm font-semibold">Artifacts</h2>
          </div>
          <span className="text-xs text-muted-foreground">{artifacts.length}</span>
        </div>

        <ScrollArea className="flex-1">
          {artifacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <LayoutGrid className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Artifacts generated in this chat will appear here.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1 p-2">
              {artifacts.map((artifact) => {
                const stored = artifactsStore.get(artifact.id)
                const when = formatWhen(stored?.createdAt ?? artifact.createdAt)
                const isDeleting = artifact.rowId
                  ? Boolean(deleting?.has(artifact.rowId))
                  : false

                return (
                  <li key={artifact.rowId ?? artifact.id}>
                    <div
                      className={cn(
                        "group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted",
                        isDeleting && "opacity-50",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          router.push(artifactHref(artifact, chatbotId))
                          onOpenChange(false)
                        }}
                        className="flex flex-1 items-start gap-3 text-left"
                      >
                        <span className="mt-0.5 text-lg" aria-hidden>
                          {artifactKindIcon(artifact.kind)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium leading-5">
                            {artifact.title}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {artifactKindLabel(artifact.kind)}
                          </p>
                          {when && (
                            <p className="mt-1 text-[11px] text-muted-foreground/80">
                              {when}
                            </p>
                          )}
                        </div>
                      </button>
                      {onDelete && artifact.rowId && (
                        <button
                          type="button"
                          aria-label={`Remove ${artifact.title}`}
                          title="Remove from this chat"
                          disabled={isDeleting}
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(artifact)
                          }}
                          className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 focus-visible:opacity-100 disabled:opacity-40"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
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

export function collectChatArtifacts(
  messages: Array<{
    artifact?: ChatArtifactItem
  }>,
): ChatArtifactItem[] {
  const seen = new Set<string>()
  const items: ChatArtifactItem[] = []

  for (const message of messages) {
    const artifact = message.artifact
    if (!artifact || seen.has(artifact.id)) continue
    seen.add(artifact.id)
    items.push(artifact)
  }

  return items
}
