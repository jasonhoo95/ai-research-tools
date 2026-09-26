"use client"

import * as React from "react"
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist"
import { AlertCircle, Loader2 } from "lucide-react"

import { chatRepo } from "@/lib/chat-repo"
import type { ChatFileItem, FileReference } from "@/lib/chat-types"
import { clearHighlights, findPassageRanges, paintHighlights } from "@/lib/passage-highlight"
import { loadPdfjs } from "@/lib/pdfjs"

/** A reference to reveal; `key` changes on every click so repeats re-scroll. */
export type ViewerFocus = { reference: FileReference; key: number }

type Pdfjs = Awaited<ReturnType<typeof loadPdfjs>>

// Originals are fetched once per session (signed URLs expire; bytes don't).
const bytesCache = new Map<string, Promise<ArrayBuffer>>()

function loadBytes(chatId: string, fileId: string): Promise<ArrayBuffer> {
  let bytes = bytesCache.get(fileId)
  if (!bytes) {
    bytes = chatRepo
      .fileUrl(chatId, fileId)
      .then(({ url }) => fetch(url))
      .then((response) => {
        if (!response.ok) throw new Error(`Download failed (${response.status})`)
        return response.arrayBuffer()
      })
    bytes.catch(() => bytesCache.delete(fileId))
    bytesCache.set(fileId, bytes)
  }
  return bytes
}

const sameReference = (a?: FileReference, b?: FileReference) =>
  Boolean(a && b && a.fileId === b.fileId && a.chunkIndex === b.chunkIndex)

/** Scroll `container` so `range` sits in its upper third. */
function revealRange(container: HTMLElement, range: Range) {
  const rect = range.getBoundingClientRect()
  const box = container.getBoundingClientRect()
  container.scrollTo({
    top: container.scrollTop + rect.top - box.top - box.height / 3,
    behavior: "smooth",
  })
}

/**
 * Paint the references found under their roots and scroll to the focused one
 * once. `rootsFor` returns where a reference can be (e.g. its PDF page's text
 * layer, if rendered); `revealMissing` brings an unrendered page into view.
 */
function useReferenceHighlights({
  container,
  references,
  focus,
  rootsFor,
  revealMissing,
  version,
}: {
  container: React.RefObject<HTMLElement | null>
  references: FileReference[]
  focus: ViewerFocus | null
  rootsFor: (reference: FileReference) => Node[]
  revealMissing?: (reference: FileReference) => boolean
  /** Changes when more of the document has rendered. */
  version: unknown
}) {
  const revealedKey = React.useRef<number | null>(null)

  React.useEffect(() => {
    const focusRanges: Range[] = []
    const otherRanges: Range[] = []
    for (const reference of references) {
      for (const root of rootsFor(reference)) {
        const ranges = findPassageRanges(root, reference.text)
        if (!ranges.length) continue
        ;(sameReference(reference, focus?.reference) ? focusRanges : otherRanges).push(...ranges)
        break
      }
    }
    paintHighlights(focusRanges, otherRanges)

    const box = container.current
    if (!focus || !box || revealedKey.current === focus.key) return
    if (focusRanges.length) {
      revealRange(box, focusRanges[0])
      revealedKey.current = focus.key
    } else if (!revealMissing?.(focus.reference)) {
      // Rendered, but the passage text wasn't found: stop trying.
      revealedKey.current = focus.key
    }
    // rootsFor / revealMissing are recreated each render; `version` tracks
    // what they depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [references, focus, version])

  React.useEffect(() => clearHighlights, [])
}

// -----------------------------------------------------------------------------
// PDF
// -----------------------------------------------------------------------------

function PdfPage({
  pdfjs,
  page,
  pageNumber,
  scale,
  scrollRoot,
  onTextLayer,
}: {
  pdfjs: Pdfjs
  page: PDFPageProxy
  pageNumber: number
  scale: number
  scrollRoot: HTMLElement | null
  onTextLayer: (pageNumber: number, layer: HTMLElement | null) => void
}) {
  const pageRef = React.useRef<HTMLDivElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const textRef = React.useRef<HTMLDivElement>(null)
  const [visible, setVisible] = React.useState(false)
  const base = page.getViewport({ scale: 1 })

  // Render pages as they come near the viewport; keep them once rendered.
  React.useEffect(() => {
    const el = pageRef.current
    if (!el || visible) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true)
      },
      { root: scrollRoot, rootMargin: "800px 0px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [scrollRoot, visible])

  React.useEffect(() => {
    const canvas = canvasRef.current
    const textDiv = textRef.current
    if (!visible || !canvas || !textDiv || scale <= 0) return
    const viewport = page.getViewport({ scale })
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.floor(viewport.width * ratio)
    canvas.height = Math.floor(viewport.height * ratio)
    const render = page.render({
      canvas,
      viewport,
      transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
    })
    render.promise.catch(() => {})

    textDiv.replaceChildren()
    const textLayer = new pdfjs.TextLayer({
      textContentSource: page.streamTextContent(),
      container: textDiv,
      viewport,
    })
    let cancelled = false
    textLayer
      .render()
      .then(() => {
        if (!cancelled) onTextLayer(pageNumber, textDiv)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      render.cancel()
      textLayer.cancel()
      onTextLayer(pageNumber, null)
    }
    // onTextLayer is stable (a state setter wrapper in the parent).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, scale, page, pdfjs, pageNumber])

  return (
    <div
      ref={pageRef}
      data-page={pageNumber}
      className="relative shrink-0 bg-white shadow-sm ring-1 ring-black/5"
      style={
        {
          width: base.width * scale,
          height: base.height * scale,
          "--scale-factor": scale,
          "--total-scale-factor": scale,
        } as React.CSSProperties
      }
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ width: base.width * scale, height: base.height * scale }}
      />
      <div ref={textRef} className="textLayer" />
    </div>
  )
}

function PdfView({
  data,
  references,
  focus,
}: {
  data: ArrayBuffer
  references: FileReference[]
  focus: ViewerFocus | null
}) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  // Also kept in state: pages observe visibility within it.
  const [scrollRoot, setScrollRoot] = React.useState<HTMLDivElement | null>(null)
  const setScrollEl = React.useCallback((el: HTMLDivElement | null) => {
    scrollRef.current = el
    setScrollRoot(el)
  }, [])
  const [pdfjs, setPdfjs] = React.useState<Pdfjs | null>(null)
  const [pages, setPages] = React.useState<PDFPageProxy[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [width, setWidth] = React.useState(0)
  const [layers, setLayers] = React.useState<ReadonlyMap<number, HTMLElement>>(new Map())

  React.useEffect(() => {
    let task: ReturnType<Pdfjs["getDocument"]> | null = null
    let cancelled = false
    ;(async () => {
      try {
        const lib = await loadPdfjs()
        if (cancelled) return
        // pdf.js takes ownership of the buffer; keep the cached copy intact.
        task = lib.getDocument({ data: new Uint8Array(data.slice(0)) })
        const doc: PDFDocumentProxy = await task.promise
        const loaded = await Promise.all(
          Array.from({ length: doc.numPages }, (_, i) => doc.getPage(i + 1)),
        )
        if (cancelled) return
        setPdfjs(lib)
        setPages(loaded)
      } catch (err) {
        if (!cancelled) setError((err as Error).message || "Could not open this PDF.")
      }
    })()
    return () => {
      cancelled = true
      void task?.destroy()
    }
  }, [data])

  // Fit pages to the viewer's width.
  React.useEffect(() => {
    if (!scrollRoot) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(scrollRoot)
    return () => observer.disconnect()
  }, [scrollRoot])

  const maxPageWidth = React.useMemo(
    () => Math.max(1, ...pages.map((p) => p.getViewport({ scale: 1 }).width)),
    [pages],
  )
  // Round so tiny width changes don't re-render every page.
  const scale = width ? Math.round(Math.min(2.5, (width - 48) / maxPageWidth) * 100) / 100 : 0

  const onTextLayer = React.useCallback((pageNumber: number, layer: HTMLElement | null) => {
    setLayers((prev) => {
      const next = new Map(prev)
      if (layer) next.set(pageNumber, layer)
      else next.delete(pageNumber)
      return next
    })
  }, [])

  useReferenceHighlights({
    container: scrollRef,
    references,
    focus,
    version: layers,
    rootsFor: (reference) =>
      reference.page
        ? [layers.get(reference.page)].filter((l): l is HTMLElement => Boolean(l))
        : [...layers.values()],
    revealMissing: (reference) => {
      // Its page hasn't rendered yet: scroll to it so it does. (Not
      // scrollIntoView — that also scrolls the page around the viewer.)
      if (!reference.page || layers.has(reference.page)) return false
      const box = scrollRef.current
      const pageEl = box?.querySelector(`[data-page="${reference.page}"]`)
      if (!box || !pageEl) return false
      box.scrollTop += pageEl.getBoundingClientRect().top - box.getBoundingClientRect().top - 16
      return true
    },
  })

  return (
    <div ref={setScrollEl} className="doc-viewer h-full overflow-auto bg-[#f4f4f5]">
      {error ? (
        <ViewerMessage error>{error}</ViewerMessage>
      ) : !pdfjs || !pages.length || !scale ? (
        <ViewerMessage>Opening PDF…</ViewerMessage>
      ) : (
        <div className="flex flex-col items-center gap-4 px-6 py-6">
          {pages.map((page, i) => (
            <PdfPage
              key={i}
              pdfjs={pdfjs}
              page={page}
              pageNumber={i + 1}
              scale={scale}
              scrollRoot={scrollRoot}
              onTextLayer={onTextLayer}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Word (.docx) and text
// -----------------------------------------------------------------------------

function useTextHighlights(
  scrollRef: React.RefObject<HTMLElement | null>,
  contentRef: React.RefObject<HTMLElement | null>,
  ready: unknown,
  references: FileReference[],
  focus: ViewerFocus | null,
) {
  useReferenceHighlights({
    container: scrollRef,
    references,
    focus,
    version: ready,
    rootsFor: () => (ready && contentRef.current ? [contentRef.current] : []),
  })
}

function DocxView({
  data,
  references,
  focus,
}: {
  data: ArrayBuffer
  references: FileReference[]
  focus: ViewerFocus | null
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLElement>(null)
  const [html, setHtml] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const mammoth = await import("mammoth")
        const result = await mammoth.convertToHtml({ arrayBuffer: data.slice(0) })
        if (!cancelled) setHtml(result.value)
      } catch (err) {
        if (!cancelled) setError((err as Error).message || "Could not open this document.")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data])

  useTextHighlights(scrollRef, contentRef, html, references, focus)

  return (
    <div ref={scrollRef} className="doc-viewer h-full overflow-auto bg-[#f4f4f5] px-6 py-6">
      {error ? (
        <ViewerMessage error>{error}</ViewerMessage>
      ) : html === null ? (
        <ViewerMessage>Opening document…</ViewerMessage>
      ) : (
        <article
          ref={contentRef}
          className="docx-content mx-auto max-w-3xl bg-white px-12 py-10 shadow-sm ring-1 ring-black/5"
          // mammoth escapes the document's text; its HTML is the document itself.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  )
}

function TextView({
  data,
  references,
  focus,
}: {
  data: ArrayBuffer
  references: FileReference[]
  focus: ViewerFocus | null
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLPreElement>(null)
  const text = React.useMemo(() => new TextDecoder().decode(data), [data])
  useTextHighlights(scrollRef, contentRef, text, references, focus)
  return (
    <div ref={scrollRef} className="doc-viewer h-full overflow-auto bg-[#f4f4f5] px-6 py-6">
      <pre
        ref={contentRef}
        className="mx-auto max-w-3xl bg-white px-10 py-8 font-mono text-[13px] leading-6 whitespace-pre-wrap text-[#27272a] shadow-sm ring-1 ring-black/5"
      >
        {text}
      </pre>
    </div>
  )
}

function MediaView({ data, file }: { data: ArrayBuffer; file: ChatFileItem }) {
  const url = React.useMemo(
    () => URL.createObjectURL(new Blob([data], { type: file.mimeType })),
    [data, file.mimeType],
  )
  React.useEffect(() => () => URL.revokeObjectURL(url), [url])
  return (
    <div className="flex h-full items-center justify-center overflow-auto bg-[#f4f4f5] p-6">
      {file.kind === "video" ? (
        <video src={url} controls className="max-h-full max-w-full rounded-lg shadow-sm" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview
        <img src={url} alt={file.name} className="max-h-full max-w-full rounded-lg shadow-sm" />
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Viewer
// -----------------------------------------------------------------------------

function ViewerMessage({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <div className="flex h-full min-h-60 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
      {error ? (
        <AlertCircle className="size-5 text-red-500" />
      ) : (
        <Loader2 className="size-5 animate-spin" />
      )}
      <p className={error ? "text-red-600" : undefined}>{children}</p>
    </div>
  )
}

/**
 * Preview a workspace document (PDF via pdf.js, Word via mammoth, text,
 * images, video) with the passages an answer used highlighted.
 */
export function DocumentViewer({
  chatId,
  file,
  references,
  focus,
}: {
  chatId: string
  file: ChatFileItem
  /** Passages of this file to highlight. */
  references: FileReference[]
  focus: ViewerFocus | null
}) {
  const [state, setState] = React.useState<
    { fileId: string; data: ArrayBuffer } | { fileId: string; error: string } | null
  >(null)

  React.useEffect(() => {
    if (!file.previewable) return
    let cancelled = false
    loadBytes(chatId, file.id)
      .then((data) => {
        if (!cancelled) setState({ fileId: file.id, data })
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ fileId: file.id, error: err.message })
      })
    return () => {
      cancelled = true
    }
  }, [chatId, file.id, file.previewable])

  if (!file.previewable) {
    return (
      <ViewerMessage error>
        This file was uploaded before previews were kept. You can still ask questions about it.
      </ViewerMessage>
    )
  }
  if (!state || state.fileId !== file.id) return <ViewerMessage>Loading {file.name}…</ViewerMessage>
  if ("error" in state) return <ViewerMessage error>Couldn&apos;t load {file.name}: {state.error}</ViewerMessage>

  const props = { data: state.data, references, focus }
  switch (file.kind) {
    case "pdf":
      return <PdfView key={file.id} {...props} />
    case "docx":
      return <DocxView key={file.id} {...props} />
    case "image":
    case "video":
      return <MediaView key={file.id} data={state.data} file={file} />
    default:
      return <TextView key={file.id} {...props} />
  }
}
