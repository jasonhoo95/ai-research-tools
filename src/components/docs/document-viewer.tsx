"use client"

import * as React from "react"
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist"
import { AlertCircle, ExternalLink, Globe, Loader2 } from "lucide-react"

import {
  HighlightLayer,
  type DocHighlight,
  type HighlightFocus,
  type NewHighlight,
} from "@/components/docs/highlight-layer"
import { chatRepo } from "@/lib/chat-repo"
import type { ChatFileItem } from "@/lib/chat-types"
import { loadPdfjs } from "@/lib/pdfjs"

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

/** Zoom steps; 1 fits PDF pages to the viewer's width. */
export const ZOOM_LEVELS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3]

/** The next zoom step in or out from `zoom`. */
export function stepZoom(zoom: number, direction: 1 | -1) {
  const next =
    direction > 0
      ? ZOOM_LEVELS.find((level) => level > zoom + 0.001)
      : ZOOM_LEVELS.findLast((level) => level < zoom - 0.001)
  return next ?? zoom
}

/**
 * Keep the same part of the document in view when its size changes
 * (zooming, or the viewer resizing), instead of jumping.
 */
function useKeepScrollPosition(scrollEl: HTMLElement | null, size: number) {
  // Where the middle of the view was, as fractions of the content size.
  const anchor = React.useRef<{ x: number; y: number } | null>(null)

  React.useEffect(() => {
    if (!scrollEl) return
    const remember = () => {
      anchor.current = {
        x: (scrollEl.scrollLeft + scrollEl.clientWidth / 2) / scrollEl.scrollWidth,
        y: (scrollEl.scrollTop + scrollEl.clientHeight / 2) / scrollEl.scrollHeight,
      }
    }
    remember()
    scrollEl.addEventListener("scroll", remember, { passive: true })
    return () => scrollEl.removeEventListener("scroll", remember)
  }, [scrollEl])

  const lastSize = React.useRef(size)
  React.useLayoutEffect(() => {
    const at = anchor.current
    const resized = Boolean(lastSize.current) && lastSize.current !== size
    lastSize.current = size
    // Not on the first real size (e.g. a PDF's first render): stay at the top.
    if (!scrollEl || !at || !resized) return
    scrollEl.scrollTo({
      left: at.x * scrollEl.scrollWidth - scrollEl.clientWidth / 2,
      top: at.y * scrollEl.scrollHeight - scrollEl.clientHeight / 2,
    })
  }, [scrollEl, size])
}

/** What every view needs to show and create highlights. */
type HighlightProps = {
  highlights: DocHighlight[]
  focus: HighlightFocus | null
  onCreateHighlight: (highlight: NewHighlight) => void
  onOpenHighlight: (id: string) => void
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
  highlights,
  focus,
  onCreateHighlight,
  onOpenHighlight,
  zoom,
}: HighlightProps & { data: ArrayBuffer; zoom: number }) {
  // In state: pages observe their visibility within it.
  const [scrollRoot, setScrollRoot] = React.useState<HTMLDivElement | null>(null)
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
  // Fit to width, then zoom. Round so tiny width changes don't re-render
  // every page.
  const fit = Math.min(2.5, (width - 48) / maxPageWidth)
  const scale = width ? Math.max(0.1, Math.round(fit * zoom * 100) / 100) : 0
  useKeepScrollPosition(scrollRoot, scale)

  const onTextLayer = React.useCallback((pageNumber: number, layer: HTMLElement | null) => {
    setLayers((prev) => {
      const next = new Map(prev)
      if (layer) next.set(pageNumber, layer)
      else next.delete(pageNumber)
      return next
    })
  }, [])

  // Rendered text layers of these pages and their neighbours (context for
  // telling repeated text apart); none until the first page has rendered.
  const rootsFor = ({ page, endPage }: { page?: number; endPage?: number }) => {
    if (!page) return [...layers.keys()].sort((a, b) => a - b).map((p) => layers.get(p)!)
    if (!layers.has(page)) return []
    const roots: HTMLElement[] = []
    for (let p = page - 1; p <= (endPage ?? page) + 1; p++) {
      const layer = layers.get(p)
      if (layer) roots.push(layer)
    }
    return roots
  }

  // Scroll an unrendered page into view so it renders. (Not scrollIntoView —
  // that also scrolls the page around the viewer.)
  const revealPage = (page: number) => {
    const box = scrollRoot
    const pageEl = box?.querySelector(`[data-page="${page}"]`)
    if (!box || !pageEl) return
    box.scrollTo({
      top: box.scrollTop + pageEl.getBoundingClientRect().top - box.getBoundingClientRect().top - 16,
    })
  }

  return (
    <div ref={setScrollRoot} className="doc-viewer h-full overflow-auto bg-[#f4f4f5]">
      {error ? (
        <ViewerMessage error>{error}</ViewerMessage>
      ) : !pdfjs || !pages.length || !scale ? (
        <ViewerMessage>Opening PDF…</ViewerMessage>
      ) : (
        // w-max: zoomed pages wider than the viewer scroll sideways instead
        // of being cut off on the left.
        <div className="relative flex w-max min-w-full flex-col items-center gap-4 px-6 py-6">
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
          <HighlightLayer
            scrollEl={scrollRoot}
            highlights={highlights}
            version={layers}
            rootsFor={rootsFor}
            paged
            revealPage={revealPage}
            focus={focus}
            onCreate={onCreateHighlight}
            onOpen={onOpenHighlight}
          />
        </div>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Word (.docx) and text
// -----------------------------------------------------------------------------

// Word and text documents reflow: zoom scales their text and page width.
const DOC_WIDTH = 768

function DocxView({
  data,
  zoom,
  ...highlightProps
}: HighlightProps & { data: ArrayBuffer; zoom: number }) {
  const [scrollEl, setScrollEl] = React.useState<HTMLDivElement | null>(null)
  const [content, setContent] = React.useState<HTMLElement | null>(null)
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
  useKeepScrollPosition(scrollEl, zoom)

  return (
    <div ref={setScrollEl} className="doc-viewer h-full overflow-auto bg-[#f4f4f5] px-6 py-6">
      {error ? (
        <ViewerMessage error>{error}</ViewerMessage>
      ) : html === null ? (
        <ViewerMessage>Opening document…</ViewerMessage>
      ) : (
        <div className="relative mx-auto" style={{ maxWidth: DOC_WIDTH * zoom }}>
          <article
            ref={setContent}
            className="docx-content bg-white px-12 py-10 shadow-sm ring-1 ring-black/5"
            style={{ fontSize: 15 * zoom }}
            // mammoth escapes the document's text; its HTML is the document itself.
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <TextHighlights scrollEl={scrollEl} content={content} {...highlightProps} />
        </div>
      )}
    </div>
  )
}

function TextView({
  data,
  zoom,
  ...highlightProps
}: HighlightProps & { data: ArrayBuffer; zoom: number }) {
  const [scrollEl, setScrollEl] = React.useState<HTMLDivElement | null>(null)
  const [content, setContent] = React.useState<HTMLPreElement | null>(null)
  const text = React.useMemo(() => new TextDecoder().decode(data), [data])
  useKeepScrollPosition(scrollEl, zoom)
  return (
    <div ref={setScrollEl} className="doc-viewer h-full overflow-auto bg-[#f4f4f5] px-6 py-6">
      <div className="relative mx-auto" style={{ maxWidth: DOC_WIDTH * zoom }}>
        <pre
          ref={setContent}
          className="bg-white px-10 py-8 font-mono leading-[1.85] whitespace-pre-wrap text-[#27272a] shadow-sm ring-1 ring-black/5"
          style={{ fontSize: 13 * zoom }}
        >
          {text}
        </pre>
        <TextHighlights scrollEl={scrollEl} content={content} {...highlightProps} />
      </div>
    </div>
  )
}

/** Highlights over a single rendered block of text (Word or plain text). */
function TextHighlights({
  scrollEl,
  content,
  highlights,
  focus,
  onCreateHighlight,
  onOpenHighlight,
}: HighlightProps & { scrollEl: HTMLElement | null; content: HTMLElement | null }) {
  return (
    <HighlightLayer
      scrollEl={scrollEl}
      highlights={highlights}
      version={content}
      rootsFor={() => (content ? [content] : [])}
      focus={focus}
      onCreate={onCreateHighlight}
      onOpen={onOpenHighlight}
    />
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

/**
 * A document added from a pasted link: its text is indexed for questions,
 * but only YouTube videos can be shown here (web pages open on their site).
 */
function LinkView({ file }: { file: ChatFileItem }) {
  const url = file.sourceUrl ?? ""
  const videoId = youtubeId(url)
  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "")
    } catch {
      return url
    }
  })()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 overflow-auto bg-[#f4f4f5] p-6">
      {videoId ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title={file.name}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full max-w-3xl rounded-xl bg-black shadow-sm"
        />
      ) : (
        <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border bg-background p-8 text-center shadow-sm">
          <span className="flex size-12 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
            <Globe className="size-6" />
          </span>
          <p className="font-semibold">{file.name}</p>
          <p className="text-sm text-muted-foreground">
            The text of this page was saved from {host}, so you can ask about it here. Open it
            on the site to read it.
          </p>
        </div>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
      >
        <ExternalLink className="size-4" />
        {videoId ? "Watch on YouTube" : `Open on ${host}`}
      </a>
    </div>
  )
}

function youtubeId(link: string): string | null {
  try {
    const url = new URL(link)
    const id =
      url.hostname === "youtu.be"
        ? url.pathname.slice(1)
        : (url.searchParams.get("v") ??
          url.pathname.match(/^\/(?:shorts|live|embed|v)\/([^/?#]+)/)?.[1])
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
  } catch {
    return null
  }
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
 * images, video). Selected text can be kept as a highlight with a note.
 */
export function DocumentViewer({
  chatId,
  file,
  zoom = 1,
  ...highlightProps
}: HighlightProps & {
  chatId: string
  file: ChatFileItem
  /** 1 = fit to width (PDF) or normal size (Word, text). */
  zoom?: number
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

  if (!file.previewable && file.sourceUrl) return <LinkView file={file} />
  if (!file.previewable) {
    return (
      <ViewerMessage error>
        This file was uploaded before previews were kept. You can still ask questions about it.
      </ViewerMessage>
    )
  }
  if (!state || state.fileId !== file.id) return <ViewerMessage>Loading {file.name}…</ViewerMessage>
  if ("error" in state) return <ViewerMessage error>Couldn&apos;t load {file.name}: {state.error}</ViewerMessage>

  const props = { data: state.data, zoom, ...highlightProps }
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
