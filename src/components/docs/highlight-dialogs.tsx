"use client"

import * as React from "react"
import { FileText, Loader2, LocateFixed, Pencil, Trash2 } from "lucide-react"

import type { DocHighlight } from "@/components/docs/highlight-layer"
import { Markdown } from "@/components/markdown"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"

export type HighlightNote = { title: string; description: string }

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback

function Quote({ text, source }: { text: string; source?: string }) {
  return (
    <figure className="rounded-lg border-l-4 border-amber-400 bg-amber-50 px-3 py-2 dark:bg-amber-500/10">
      <blockquote className="line-clamp-6 text-sm leading-6 text-foreground/90">{text}</blockquote>
      {source ? (
        <figcaption className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <FileText className="size-3" />
          {source}
        </figcaption>
      ) : null}
    </figure>
  )
}

export const highlightSource = (fileName: string, page?: number) =>
  page ? `${fileName} · page ${page}` : fileName

/** Title and note for newly selected text. */
export function InsertHighlightDialog({
  open,
  onOpenChange,
  quote,
  source,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  quote: string
  source: string
  onSave: (note: HighlightNote) => Promise<void>
}) {
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // A fresh form for every selection.
  const [formFor, setFormFor] = React.useState(quote)
  if (formFor !== quote) {
    setFormFor(quote)
    setTitle("")
    setDescription("")
    setError(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = title.replace(/\s+/g, " ").trim()
    if (!trimmed || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSave({ title: trimmed, description: description.trim() })
    } catch (err) {
      setError(errorMessage(err, "Could not save the highlight."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Insert text</DialogTitle>
            <DialogDescription>
              Keep this passage with a note. It stays highlighted in the document and is listed
              under Artifacts.
            </DialogDescription>
          </DialogHeader>
          <Quote text={quote} source={source} />
          <div className="grid gap-2">
            <Label htmlFor="highlight-title">Title</Label>
            <Input
              id="highlight-title"
              autoFocus
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Key finding on sample size"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="highlight-description">Description</Label>
            <Textarea
              id="highlight-description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why it matters, how you'll use it. Markdown works."
            />
          </div>
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save highlight
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** A saved highlight's note: read it, edit it, jump to it or delete it. */
export function HighlightSheet({
  highlight,
  open,
  onOpenChange,
  onSave,
  onDelete,
  onShow,
}: {
  /** Stays set while the sheet slides out. */
  highlight: DocHighlight | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (note: HighlightNote) => Promise<void>
  onDelete: () => Promise<void>
  onShow: () => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [busy, setBusy] = React.useState<"saving" | "deleting" | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Reset when another highlight is opened.
  const [shownId, setShownId] = React.useState(highlight?.id)
  if (shownId !== highlight?.id) {
    setShownId(highlight?.id)
    setEditing(false)
    setConfirmDelete(false)
    setError(null)
  }

  const startEditing = () => {
    if (!highlight) return
    setTitle(highlight.artifact.title)
    setDescription(highlight.artifact.description ?? "")
    setEditing(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = title.replace(/\s+/g, " ").trim()
    if (!trimmed || busy) return
    setBusy("saving")
    setError(null)
    try {
      await onSave({ title: trimmed, description: description.trim() })
      setEditing(false)
    } catch (err) {
      setError(errorMessage(err, "Could not save your changes."))
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setBusy("deleting")
    setError(null)
    try {
      await onDelete()
    } catch (err) {
      setError(errorMessage(err, "Could not delete the highlight."))
      setConfirmDelete(false)
    } finally {
      setBusy(null)
    }
  }

  const artifact = highlight?.artifact

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {artifact ? (
          <>
            <SheetHeader>
              <SheetDescription>Highlight</SheetDescription>
              <SheetTitle className="text-lg leading-snug">{artifact.title}</SheetTitle>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
              <Quote text={artifact.quote} source={highlightSource(artifact.fileName, artifact.page)} />

              {editing ? (
                <form onSubmit={save} className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="highlight-edit-title">Title</Label>
                    <Input
                      id="highlight-edit-title"
                      autoFocus
                      value={title}
                      maxLength={200}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="highlight-edit-description">Description</Label>
                    <Textarea
                      id="highlight-edit-description"
                      rows={8}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Why it matters, how you'll use it. Markdown works."
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy === "saving"}
                      onClick={() => setEditing(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={!title.trim() || busy === "saving"}>
                      {busy === "saving" ? <Loader2 className="size-3.5 animate-spin" /> : null}
                      Save
                    </Button>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Description
                    </p>
                    <Button variant="ghost" size="sm" onClick={startEditing}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                  </div>
                  {artifact.description ? (
                    <div className="text-sm text-foreground/90">
                      <Markdown>{artifact.description}</Markdown>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startEditing}
                      className="w-full rounded-lg border border-dashed px-3 py-6 text-sm text-muted-foreground hover:bg-muted"
                    >
                      Add a description
                    </button>
                  )}
                </div>
              )}

              {error ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}
            </div>

            <SheetFooter className="justify-between">
              <Button variant="outline" size="sm" onClick={onShow}>
                <LocateFixed className="size-3.5" />
                Show in document
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy === "deleting"}
                onClick={() => void remove()}
                onBlur={() => setConfirmDelete(false)}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                {busy === "deleting" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                {confirmDelete ? "Click again to delete" : "Delete"}
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
