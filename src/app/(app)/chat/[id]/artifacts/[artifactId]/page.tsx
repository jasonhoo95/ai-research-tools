"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api"
import { chatRepo, type MessageArtifactResult } from "@/lib/chat-repo"
import type { Artifact } from "@/lib/chat-types"
import { useArtifactStore } from "@/store/artifact-stores"
import { artifactKindLabel } from "@/lib/artifact-labels"
import { artifactsStore } from "@/lib/artifacts-store"
import { ArtifactChart } from "@/components/artifact/artifact-chart"
import { ArtifactTable } from "@/components/artifact/artifact-table"
import { ArtifactSlides } from "@/components/artifact/artifact-slides"
import { ArtifactNotes } from "@/components/artifact/artifact-notes"
import { ArtifactNotesboard } from "@/components/artifact/artifact-notesboard"
import { ArtifactBio } from "@/components/artifact/artifact-bio"

const KNOWN_KINDS: ReadonlyArray<Artifact["kind"]> = [
  "chart",
  "table",
  "slide",
  "notesboard",
  "notes",
  "bio",
]

function artifactFromResult(data: MessageArtifactResult): Artifact | null {
  if (isRenderableArtifact(data.artifact)) return data.artifact
  const nested = (data as { content?: { artifact?: unknown } }).content?.artifact
  return isRenderableArtifact(nested) ? nested : null
}

function isRenderableArtifact(value: unknown): value is Artifact {
  if (!value || typeof value !== "object") return false
  const a = value as Record<string, unknown>
  if (!(KNOWN_KINDS as ReadonlyArray<unknown>).includes(a.kind)) return false
  // Older messages stored only { id, kind, title } — no renderable body.
  switch (a.kind) {
    case "chart":
      return Array.isArray(a.data)
    case "table":
      return Array.isArray(a.columns) && Array.isArray(a.rows)
    case "slide":
      return Array.isArray(a.slides)
    case "notesboard":
      return Array.isArray(a.notes)
    case "notes":
      return typeof a.content === "string" || Array.isArray(a.content)
    case "bio":
      return Array.isArray(a.sections)
    default:
      return false
  }
}

/**
 * The editors save from `result.content.artifact`, so when the body comes
 * from the local cache, graft it in — the first edit then writes the full
 * artifact back to the backend.
 */
function withArtifact(
  result: MessageArtifactResult,
  artifact: Artifact,
): MessageArtifactResult {
  const row = result as unknown as { content?: Record<string, unknown> }
  return {
    ...result,
    artifact,
    content: { ...row.content, artifact },
  } as MessageArtifactResult
}

/**
 * Route: /chat/[id]/artifacts/[artifactId]
 *
 * Fetches the artifact from the backend by looking it up on the parent
 * chatbot's messages (via GET /api/chats/:id/messages/artifacts/:artifactId).
 * Nothing is read from localStorage.
 */
export default function ArtifactFromMessagePage() {
  const params = useParams<{ id: string; artifactId: string }>()
  const router = useRouter()
  const chatbotId = params?.id
  const artifactId = params?.artifactId

  const [result, setResult] = React.useState<MessageArtifactResult | null>(null)
  const [status, setStatus] = React.useState<
    "loading" | "ready" | "not-found" | "error"
  >("loading")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const storedArtifact = useArtifactStore((state) =>
    artifactId ? state.artifacts[artifactId]?.artifact : undefined,
  )
  const saveStatus = useArtifactStore((state) => state.saveStatus)
  const saveError = useArtifactStore((state) => state.error)

  React.useEffect(() => {
    if (!chatbotId || !artifactId) return
    let alive = true
    setStatus("loading")
    setErrorMessage(null)

    chatRepo
      .getMessageArtifact(chatbotId, artifactId)
      .then((data) => {
        if (!alive) return
        if (!data) {
          setStatus("not-found")
          return
        }
        const loaded = data
        console.log("loaded", loaded)
        // if (loaded) {
        //   useArtifactStore.getState().setCurrentArtifact({
        //     chatbotId,
        //     artifactId,
        //     artifact: loaded.artifact,
        //   })
        // }
        setResult(data)
        setStatus("ready")
      })
      .catch((err) => {
        if (!alive) return
        setStatus("error")
        setErrorMessage(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to load artifact",
        )
      })

    return () => {
      alive = false
    }
  }, [chatbotId, artifactId])

  const backHref = chatbotId ? `/chat/${chatbotId}` : "/chat"

  if (status === "loading") {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Loading artifact…
      </main>
    )
  }

  if (status === "not-found") {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-semibold">Artifact not found</h1>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          This artifact isn&apos;t attached to any message in this chat. It may
          have been generated in a different conversation.
        </p>
        <Button onClick={() => router.push(backHref)}>Back to chat</Button>
      </main>
    )
  }

  if (status === "error" || !result) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-semibold">Couldn&apos;t load artifact</h1>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          {errorMessage ?? "Please try again in a moment."}
        </p>
        <Button onClick={() => router.push(backHref)}>Back to chat</Button>
      </main>
    )
  }
  const fromBackend = artifactFromResult(result)
  const cached = fromBackend ? null : artifactsStore.get(artifactId)?.artifact
  const artifact =
    storedArtifact ?? fromBackend ?? (isRenderableArtifact(cached) ? cached : null)
  if (!artifact) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-semibold">Artifact content unavailable</h1>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          This artifact was created before its content was saved with the
          chat, so only its title was kept. Ask the assistant to generate it
          again to get an editable copy.
        </p>
        <Button onClick={() => router.push(backHref)}>Back to chat</Button>
      </main>
    )
  }
  const view = fromBackend ? result : withArtifact(result, artifact)

  const kindLabel = artifactKindLabel(artifact?.kind)
  const isWideLayout =
    artifact.kind === "notesboard" ||
    artifact.kind === "notes" ||
    artifact.kind === "slide" ||
    artifact.kind === "bio"
  const saveStatusLabel =
    artifact.kind === "notes"
      ? saveStatus === "pending" || saveStatus === "saving"
        ? "Saving…"
        : saveStatus === "saved"
          ? "Saved"
          : saveStatus === "error"
            ? "Save failed"
            : null
      : null

  return (
    <main
      className={`mx-auto w-full flex-1 px-4 py-10 ${isWideLayout ? "max-w-7xl" : "max-w-5xl"}`}
    >
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">{kindLabel}</Badge>
            <span className="text-xs text-muted-foreground">
              Generated{" "}
              {new Date(
                view.messageCreatedAt ??
                  (view as { created_at?: string }).created_at ??
                  "",
              ).toLocaleString()}
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{artifact.title}</h1>
        </div>
        {saveStatusLabel ? (
          <span
            className={`text-xs ${saveStatus === "error"
              ? "text-red-600"
              : "text-muted-foreground"
              }`}
          >
            {saveStatusLabel}
          </span>
        ) : null}
      </div>
      {saveError && saveStatus === "error" ? (
        <p className="mb-4 text-sm text-red-600">{saveError}</p>
      ) : null}

      <div
        className={
          isWideLayout
            ? "rounded-2xl border bg-card p-2 sm:p-4"
            : "rounded-2xl border bg-card p-4 sm:p-6"
        }
      >
        {artifact.kind === "chart" && <ArtifactChart artifact={artifact} />}
        {artifact.kind === "table" && <ArtifactTable artifact={artifact} />}
        {artifact.kind === "slide" && <ArtifactSlides data={view} artifact={artifact} />}
        {artifact.kind === "notesboard" && (
          <ArtifactNotesboard data={view} artifact={artifact} />
        )}
        {artifact.kind === "notes" && <ArtifactNotes data={view} artifact={artifact} />}
        {artifact.kind === "bio" && <ArtifactBio data={view} artifact={artifact} />}
      </div>

      {artifact.kind === "chart" && (
        <details className="mt-6 rounded-lg border p-4 text-sm">
          <summary className="cursor-pointer font-medium">Data</summary>
          <pre className="mt-3 overflow-x-auto rounded bg-muted/40 p-3 text-xs">
            {JSON.stringify(artifact.data, null, 2)}
          </pre>
        </details>
      )}
    </main>
  )
}
