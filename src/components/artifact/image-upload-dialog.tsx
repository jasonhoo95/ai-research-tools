"use client"

import * as React from "react"
import { Check, ImageIcon, Loader2, Trash2, Upload } from "lucide-react"

import { AppDialog } from "@/components/dialog"
import { Button } from "@/components/ui/button"
import { ApiError } from "@/lib/api"
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  artifactImages,
  type StoredImage,
} from "@/lib/artifact-images"
import { cn } from "@/lib/utils"

type Shape = "banner" | "avatar"

type Pending =
  | { kind: "file"; file: File; previewUrl: string }
  | { kind: "url"; url: string }
  | null

function errorMessage(err: unknown) {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return "Something went wrong"
}

/** Preview framed like the real placement (wide banner or round avatar). */
function ShapedPreview({ src, shape }: { src: string; shape: Shape }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Selected image preview"
      className={cn(
        "border object-cover shadow-sm",
        shape === "banner" ? "aspect-[4/1] w-full rounded-lg" : "size-40 rounded-full",
      )}
    />
  )
}

/**
 * Pick an image for an artifact: upload a new one from the device, or choose
 * one already stored for this artifact (the gallery). Optionally remove the
 * current image.
 */
export function ImageUploadDialog({
  open,
  onOpenChange,
  title,
  shape,
  folder,
  currentUrl,
  onSelect,
  onRemove,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  shape: Shape
  /** Storage folder for this artifact, e.g. "bio/<artifactId>". */
  folder: string
  currentUrl?: string
  onSelect: (url: string) => void
  onRemove?: () => void
}) {
  const [tab, setTab] = React.useState<"upload" | "gallery">("upload")
  const [pending, setPending] = React.useState<Pending>(null)
  const [dragging, setDragging] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [gallery, setGallery] = React.useState<StoredImage[] | null>(null)
  const [galleryError, setGalleryError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Reset each time the dialog opens.
  React.useEffect(() => {
    if (!open) return
    setTab("upload")
    setPending(null)
    setError(null)
    setSaving(false)
    setGallery(null)
    setGalleryError(null)
  }, [open])

  // Revoke object URLs for replaced / discarded file previews.
  React.useEffect(() => {
    if (pending?.kind !== "file") return
    const url = pending.previewUrl
    return () => URL.revokeObjectURL(url)
  }, [pending])

  React.useEffect(() => {
    if (!open || tab !== "gallery" || gallery) return
    let alive = true
    artifactImages
      .list(folder)
      .then((images) => alive && setGallery(images))
      .catch((err) => alive && setGalleryError(errorMessage(err)))
    return () => {
      alive = false
    }
  }, [open, tab, gallery, folder])

  const pickFile = (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError("Choose a PNG, JPEG or WebP image.")
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Images must be 5 MB or smaller.")
      return
    }
    setPending({ kind: "file", file, previewUrl: URL.createObjectURL(file) })
  }

  const save = async () => {
    if (!pending || saving) return
    setSaving(true)
    setError(null)
    try {
      const url =
        pending.kind === "file"
          ? (await artifactImages.upload(folder, pending.file)).url
          : pending.url
      onSelect(url)
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const previewSrc =
    pending?.kind === "file" ? pending.previewUrl : pending?.kind === "url" ? pending.url : null

  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => !saving && onOpenChange(next)}
      title={title}
      description={
        shape === "banner"
          ? "Wide images work best (about 4:1)."
          : "Square images work best; it's shown as a circle."
      }
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <div role="tablist" className="inline-flex w-fit rounded-lg bg-muted p-1 text-sm">
          {(["upload", "gallery"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "rounded-md px-3 py-1 font-medium transition-colors",
                tab === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {key === "upload" ? "Upload" : "Gallery"}
            </button>
          ))}
        </div>

        {tab === "upload" ? (
          pending?.kind === "file" ? (
            <div className="flex flex-col items-center gap-3">
              <ShapedPreview src={pending.previewUrl} shape={shape} />
              <p className="max-w-full truncate text-xs text-muted-foreground">
                {pending.file.name} · {(pending.file.size / 1024 / 1024).toFixed(1)} MB
              </p>
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                Choose another
              </Button>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                pickFile(e.dataTransfer.files[0])
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                dragging ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <div className="flex size-11 items-center justify-center rounded-full bg-muted">
                <Upload className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Drag an image here</p>
                <p className="text-xs text-muted-foreground">PNG, JPEG or WebP · up to 5 MB</p>
              </div>
              <Button size="sm" onClick={() => inputRef.current?.click()}>
                Browse files
              </Button>
            </div>
          )
        ) : (
          <div className="max-h-[320px] overflow-y-auto">
            {galleryError ? (
              <p className="py-8 text-center text-sm text-red-600">{galleryError}</p>
            ) : !gallery ? (
              <div className="flex justify-center py-10 text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : gallery.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <ImageIcon className="size-6" />
                No images yet — upload one first.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {gallery.map((image) => {
                  const selected = pending?.kind === "url" && pending.url === image.url
                  const current = image.url === currentUrl
                  return (
                    <button
                      key={image.path}
                      type="button"
                      onClick={() => setPending({ kind: "url", url: image.url })}
                      aria-pressed={selected}
                      aria-label={current ? "Current image" : "Select image"}
                      className={cn(
                        "relative aspect-square overflow-hidden rounded-lg border bg-muted outline-none transition focus-visible:ring-2 focus-visible:ring-ring",
                        selected ? "ring-2 ring-primary" : "hover:opacity-90",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.url} alt="" loading="lazy" className="size-full object-cover" />
                      {selected && (
                        <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" />
                        </span>
                      )}
                      {current && !selected && (
                        <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          Current
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab === "gallery" && previewSrc && pending?.kind === "url" && shape === "banner" && (
          <ShapedPreview src={previewSrc} shape={shape} />
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            pickFile(e.target.files?.[0])
            e.target.value = ""
            setTab("upload")
          }}
        />

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          {currentUrl && onRemove ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => {
                onRemove()
                onOpenChange(false)
              }}
              className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
            >
              <Trash2 className="size-4" />
              Remove image
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2 sm:justify-end">
            <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={!pending || saving} onClick={save} className="gap-1.5">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving && pending?.kind === "file" ? "Uploading…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </AppDialog>
  )
}
