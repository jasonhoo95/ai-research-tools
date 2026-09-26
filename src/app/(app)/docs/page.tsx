"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileSearch, Loader2, Upload } from "lucide-react"

import { DOCUMENT_ACCEPT } from "@/components/docs/documents-panel"
import { chatRepo, type ChatRow } from "@/lib/chat-repo"
import { setPendingUploads } from "@/lib/pending-uploads"
import { cn } from "@/lib/utils"

/** A workspace title from its first document, e.g. "Annual report 2024". */
function titleFrom(files: File[]) {
  const base = files[0]?.name.replace(/\.[a-z0-9]{1,8}$/i, "").replace(/[_-]+/g, " ").trim()
  const title = base || "Research"
  const more = files.length > 1 ? ` + ${files.length - 1} more` : ""
  return (title.slice(0, 120 - more.length) + more).trim()
}

/** Document workspaces: start one by uploading documents, or open one. */
export default function DocsPage() {
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [workspaces, setWorkspaces] = React.useState<ChatRow[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [dragging, setDragging] = React.useState(false)

  React.useEffect(() => {
    chatRepo
      .listChats("docs")
      .then(setWorkspaces)
      .catch((err: Error) => {
        setWorkspaces([])
        setError(err.message)
      })
  }, [])

  const start = async (files: File[]) => {
    if (!files.length || creating) return
    setCreating(true)
    setError(null)
    try {
      const chat = await chatRepo.createChat({ title: titleFrom(files), kind: "docs" })
      // The workspace page uploads them, showing progress.
      setPendingUploads(chat.id, files)
      router.push(`/docs/${chat.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the workspace.")
      setCreating(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload papers, reports or contracts, read them side by side with an assistant, and see
          exactly where each answer comes from.
        </p>
      </div>

      <button
        type="button"
        disabled={creating}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void start(Array.from(e.dataTransfer.files))
        }}
        className={cn(
          "flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed px-8 py-14 text-center transition-colors",
          dragging
            ? "border-[#f97316] bg-[#f97316]/5"
            : "border-foreground/15 bg-background hover:border-[#f97316]/40",
        )}
      >
        <span className="flex size-14 items-center justify-center rounded-2xl bg-[#f97316]/10 text-[#f97316]">
          {creating ? <Loader2 className="size-7 animate-spin" /> : <Upload className="size-7" />}
        </span>
        <span className="text-lg font-semibold">
          {creating ? "Creating workspace…" : "Start a new research workspace"}
        </span>
        <span className="text-sm text-muted-foreground">
          Drop PDF or Word documents here, or click to choose. You can add more later.
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={DOCUMENT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? [])
          e.target.value = ""
          void start(picked)
        }}
      />

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Your workspaces</h2>
        {workspaces === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : workspaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workspaces yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((workspace) => (
              <li key={workspace.id}>
                <Link
                  href={`/docs/${workspace.id}`}
                  className="flex h-full items-start gap-3 rounded-2xl border bg-background p-4 transition-colors hover:border-[#f97316]/40 hover:bg-[#f97316]/5"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f97316]/10 text-[#f97316]">
                    <FileSearch className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{workspace.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {new Date(workspace.created_at).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
